"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import { Octokit } from "@octokit/rest";
import simpleGit from "simple-git";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";

// --- PANIC KEYWORDS WITH SEVERITY WEIGHTS (from Memoria MCP) ---
const PANIC_KEYWORDS: Record<string, number> = {
	// Critical (3x weight) - security and data integrity issues
	security: 3,
	vulnerability: 3,
	cve: 3,
	exploit: 3,
	crash: 3,
	"data loss": 3,
	corruption: 3,
	breach: 3,
	// High (2x weight) - urgent fixes and breaking changes
	revert: 2,
	hotfix: 2,
	urgent: 2,
	breaking: 2,
	critical: 2,
	emergency: 2,
	rollback: 2,
	regression: 2,
	// Normal (1x weight) - standard bug fixes
	fix: 1,
	bug: 1,
	patch: 1,
	oops: 1,
	typo: 1,
	issue: 1,
	error: 1,
	wrong: 1,
	mistake: 1,
	broken: 1,
	// Low (0.5x weight) - maintenance work
	refactor: 0.5,
	cleanup: 0.5,
	lint: 0.5,
	format: 0.5,
};

// --- TIME DECAY CALCULATION ---
function calculateRecencyDecay(commitDate: Date): number {
	const now = Date.now();
	const daysAgo = Math.floor((now - commitDate.getTime()) / (1000 * 60 * 60 * 24));
	return 0.5 ** (daysAgo / 30);
}

// --- FILE ANALYSIS RESULT ---
interface FileAnalysis {
	file: string;
	volatility: {
		commitCount: number;
		panicScore: number;
		authors: number;
	};
	coupledFiles: Array<{
		file: string;
		score: number;
		reason: string;
	}>;
	importers: string[];
	riskScore: number;
	riskLevel: "low" | "medium" | "high" | "critical";
}

// --- COMPOUND RISK CALCULATOR ---
function calculateCompoundRisk(
	volatility: { panicScore: number; commitCount: number },
	coupled: Array<{ file: string; score: number }>,
	importers: string[] = []
): { score: number; level: "low" | "medium" | "high" | "critical" } {
	const VOLATILITY_WEIGHT = 0.35;
	const COUPLING_WEIGHT = 0.3;
	const IMPORTER_WEIGHT = 0.35;

	const volatilityComponent = volatility.panicScore;
	const couplingScores = coupled.slice(0, 3).map((c) => c.score);
	const couplingComponent =
		couplingScores.length > 0
			? Math.min(100, (couplingScores.reduce((a, b) => a + b, 0) / couplingScores.length) * 1.5)
			: 0;
	const importerComponent = Math.min(100, importers.length * 10);

	const score = Math.round(
		volatilityComponent * VOLATILITY_WEIGHT + couplingComponent * COUPLING_WEIGHT + importerComponent * IMPORTER_WEIGHT
	);

	let level: "low" | "medium" | "high" | "critical";
	if (score >= 75) level = "critical";
	else if (score >= 50) level = "high";
	else if (score >= 25) level = "medium";
	else level = "low";

	return { score, level };
}

// --- GET VOLATILITY FOR A FILE ---
async function getFileVolatility(
	git: ReturnType<typeof simpleGit>,
	filePath: string
): Promise<{ commitCount: number; panicScore: number; authors: number }> {
	try {
		const log = await git.log({ file: filePath, maxCount: 20 });

		let weightedPanicScore = 0;
		const maxPossibleScore = 20 * 3;
		const authorSet = new Set<string>();

		for (const commit of log.all) {
			const msgLower = commit.message.toLowerCase();
			let commitWeight = 0;

			for (const [keyword, weight] of Object.entries(PANIC_KEYWORDS)) {
				if (msgLower.includes(keyword)) {
					commitWeight = Math.max(commitWeight, weight);
				}
			}

			const commitDate = new Date(commit.date);
			const decay = calculateRecencyDecay(commitDate);

			if (commitWeight > 0) {
				weightedPanicScore += commitWeight * decay;
			}

			authorSet.add(commit.author_email || commit.author_name);
		}

		return {
			commitCount: log.total,
			panicScore: Math.min(100, Math.round((weightedPanicScore / maxPossibleScore) * 100)),
			authors: authorSet.size,
		};
	} catch {
		return { commitCount: 0, panicScore: 0, authors: 0 };
	}
}

// --- GET COUPLED FILES ---
async function getCoupledFiles(
	git: ReturnType<typeof simpleGit>,
	filePath: string,
	analysisWindow: number = 50
): Promise<Array<{ file: string; score: number; reason: string }>> {
	try {
		const log = await git.log({ file: filePath, maxCount: analysisWindow });
		if (log.total < 3) return [];

		const couplingMap: Record<string, { count: number; reason: string }> = {};
		const fileName = path.basename(filePath);

		for (const commit of log.all) {
			const show = await git.show([commit.hash, "--name-only", "--format="]).catch(() => "");
			const files = show
				.split("\n")
				.map((f) => f.trim())
				.filter((f) => f && !f.includes(fileName));

			// Skip bulk commits
			if (files.length > 15) continue;

			for (const file of files) {
				if (!couplingMap[file]) {
					couplingMap[file] = { count: 0, reason: commit.message.split("\n")[0].slice(0, 60) };
				}
				couplingMap[file].count++;
			}
		}

		return Object.entries(couplingMap)
			.sort(([, a], [, b]) => b.count - a.count)
			.slice(0, 5)
			.map(([file, data]) => ({
				file,
				score: Math.round((data.count / log.total) * 100),
				reason: data.reason,
			}))
			.filter((x) => x.score > 15);
	} catch {
		return [];
	}
}

// --- GET IMPORTERS ---
async function getImporters(git: ReturnType<typeof simpleGit>, filePath: string): Promise<string[]> {
	try {
		const fileName = path.basename(filePath, path.extname(filePath));
		const importPattern = `(import|from|require).*['"].*${fileName}`;
		const grepResult = await git.raw(["grep", "-l", "-E", "--", importPattern]).catch(() => "");

		return grepResult
			.split("\n")
			.map((line) => line.trim())
			.filter((f) => f && path.basename(f) !== path.basename(filePath))
			.slice(0, 20);
	} catch {
		return [];
	}
}

// --- GENERATE COMMENT MARKDOWN ---
function generateComment(
	prNumber: number,
	repoFullName: string,
	overallRisk: { score: number; level: string },
	fileAnalyses: FileAnalysis[],
	mode: "short" | "detailed"
): string {
	const riskEmoji = { low: "✅", medium: "⚠️", high: "🔥", critical: "🚨" }[overallRisk.level] || "❓";

	let comment = `## ${riskEmoji} Memoria Risk Analysis\n\n`;
	comment += `**Overall Risk: ${overallRisk.score}/100 (${overallRisk.level.toUpperCase()})**\n\n`;

	if (mode === "short") {
		// Short mode - just summary
		const highRiskFiles = fileAnalyses.filter((f) => f.riskLevel === "high" || f.riskLevel === "critical");
		if (highRiskFiles.length > 0) {
			comment += `### ⚠️ High-Risk Files\n`;
			for (const file of highRiskFiles.slice(0, 5)) {
				comment += `- \`${file.file}\` (${file.riskScore}/100)\n`;
			}
		}

		const allCoupled = new Set<string>();
		for (const file of fileAnalyses) {
			for (const coupled of file.coupledFiles) {
				allCoupled.add(coupled.file);
			}
		}

		if (allCoupled.size > 0) {
			comment += `\n### 🔗 Related Files to Check\n`;
			for (const file of Array.from(allCoupled).slice(0, 5)) {
				comment += `- [ ] \`${file}\`\n`;
			}
		}
	} else {
		// Detailed mode - full breakdown
		comment += `### File Analysis\n\n`;
		for (const file of fileAnalyses.slice(0, 10)) {
			const emoji = { low: "✅", medium: "⚠️", high: "🔥", critical: "🚨" }[file.riskLevel] || "❓";
			comment += `#### ${emoji} \`${file.file}\`\n`;
			comment += `- Risk: ${file.riskScore}/100 (${file.riskLevel})\n`;
			comment += `- Volatility: ${file.volatility.panicScore}% panic score, ${file.volatility.commitCount} commits\n`;

			if (file.coupledFiles.length > 0) {
				comment += `- Coupled files:\n`;
				for (const coupled of file.coupledFiles.slice(0, 3)) {
					comment += `  - \`${coupled.file}\` (${coupled.score}% coupled)\n`;
				}
			}

			if (file.importers.length > 0) {
				comment += `- Importers: ${file.importers.length} files depend on this\n`;
			}
			comment += "\n";
		}

		if (fileAnalyses.length > 10) {
			comment += `*...and ${fileAnalyses.length - 10} more files*\n\n`;
		}
	}

	comment += `\n---\n`;
	comment += `*Analyzed by [Memoria](https://memoria.byronwade.com) - The Memory Your AI Lacks*`;

	return comment;
}

// --- GITHUB APP JWT GENERATION ---
function generateAppJWT(): string {
	const appId = process.env.GITHUB_APP_ID;
	const privateKey = process.env.GITHUB_PRIVATE_KEY?.replace(/\\n/g, "\n");

	if (!appId || !privateKey) {
		throw new Error("GitHub App credentials not configured");
	}

	const now = Math.floor(Date.now() / 1000);
	const payload = {
		iat: now - 60,
		exp: now + 600,
		iss: appId,
	};

	return jwt.sign(payload, privateKey, { algorithm: "RS256" });
}

// --- GET INSTALLATION TOKEN ---
async function getInstallationToken(installationId: number): Promise<string> {
	const appJwt = generateAppJWT();
	const octokit = new Octokit({ auth: appJwt });

	const response = await octokit.apps.createInstallationAccessToken({
		installation_id: installationId,
	});

	return response.data.token;
}

/**
 * Run PR analysis using Memoria engines
 */
export const runPRAnalysis = internalAction({
	args: {
		pullRequestId: v.id("pull_requests"),
		installationId: v.number(),
		repoFullName: v.string(),
		prNumber: v.number(),
	},
	handler: async (ctx, args) => {
		const startTime = Date.now();
		let tempDir: string | null = null;

		try {
			// 1. Get PR and repo from database
			const pr = await ctx.runQuery(api.scm.getPullRequest, { pullRequestId: args.pullRequestId });
			if (!pr) {
				console.error("PR not found:", args.pullRequestId);
				return { success: false, error: "PR not found" };
			}

			const repo = await ctx.runQuery(api.scm.getRepository, { repoId: pr.repoId });
			if (!repo) {
				console.error("Repository not found:", pr.repoId);
				return { success: false, error: "Repository not found" };
			}

			// 2. Get org settings for comment mode
			const orgSettings = await ctx.runQuery(api.orgs.getOrgSettings, { orgId: repo.orgId });
			const commentMode = orgSettings?.riskCommentMode || "short";

			// 3. Get installation token
			const token = await getInstallationToken(args.installationId);
			const octokit = new Octokit({ auth: token });

			// 4. Get PR files from GitHub
			const [owner, repoName] = args.repoFullName.split("/");
			const { data: files } = await octokit.pulls.listFiles({
				owner,
				repo: repoName,
				pull_number: args.prNumber,
				per_page: 100,
			});

			const changedFiles = files.map((f) => f.filename);

			// 5. Clone repository to temp directory (shallow clone)
			tempDir = path.join(os.tmpdir(), `memoria-${crypto.randomUUID()}`);
			await fs.mkdir(tempDir, { recursive: true });

			const cloneUrl = `https://x-access-token:${token}@github.com/${args.repoFullName}.git`;
			const git = simpleGit(tempDir);

			await git.clone(cloneUrl, tempDir, ["--depth", "100", "--single-branch", "--branch", pr.targetBranch]);

			// Fetch the PR branch too for comparison
			await git.fetch("origin", pr.sourceBranch, ["--depth", "100"]).catch(() => {
				// May not exist if PR is from fork
			});

			// 6. Analyze each changed file
			const fileAnalyses: FileAnalysis[] = [];

			for (const file of changedFiles.slice(0, 50)) {
				// Limit to 50 files
				const filePath = path.join(tempDir, file);

				// Check if file exists (might be deleted)
				const fileExists = await fs
					.access(filePath)
					.then(() => true)
					.catch(() => false);
				if (!fileExists) continue;

				const [volatility, coupledFiles, importers] = await Promise.all([
					getFileVolatility(git, file),
					getCoupledFiles(git, file),
					getImporters(git, file),
				]);

				const risk = calculateCompoundRisk(volatility, coupledFiles, importers);

				fileAnalyses.push({
					file,
					volatility,
					coupledFiles,
					importers,
					riskScore: risk.score,
					riskLevel: risk.level,
				});
			}

			// 7. Calculate overall PR risk
			const avgRisk =
				fileAnalyses.length > 0
					? Math.round(fileAnalyses.reduce((sum, f) => sum + f.riskScore, 0) / fileAnalyses.length)
					: 0;
			const maxRisk = fileAnalyses.length > 0 ? Math.max(...fileAnalyses.map((f) => f.riskScore)) : 0;
			const overallScore = Math.round(avgRisk * 0.6 + maxRisk * 0.4);

			let overallLevel: "low" | "medium" | "high" | "informational";
			if (overallScore >= 75) overallLevel = "high";
			else if (overallScore >= 50) overallLevel = "high";
			else if (overallScore >= 25) overallLevel = "medium";
			else overallLevel = "low";

			// 8. Generate and post comment
			const commentBody = generateComment(
				args.prNumber,
				args.repoFullName,
				{ score: overallScore, level: overallLevel },
				fileAnalyses,
				commentMode
			);

			const { data: comment } = await octokit.issues.createComment({
				owner,
				repo: repoName,
				issue_number: args.prNumber,
				body: commentBody,
			});

			// 9. Collect missing co-changed files
			const allCoupled = new Map<string, number>();
			for (const file of fileAnalyses) {
				for (const coupled of file.coupledFiles) {
					if (!changedFiles.includes(coupled.file)) {
						const existing = allCoupled.get(coupled.file) || 0;
						allCoupled.set(coupled.file, Math.max(existing, coupled.score));
					}
				}
			}
			const missingCoChangedFiles = Array.from(allCoupled.entries())
				.map(([file, probability]) => ({ file, probability: probability / 100 }))
				.sort((a, b) => b.probability - a.probability)
				.slice(0, 10);

			// 10. Record analysis in database
			const durationMs = Date.now() - startTime;
			const { analysisId } = await ctx.runMutation(api.analyses.recordAnalysis, {
				orgId: repo.orgId,
				repoId: repo._id,
				pullRequestId: pr._id,
				commitSha: (pr.metadata as { headSha?: string })?.headSha || null,
				analysisType: "pull_request",
				engineVersion: "1.0.0",
				riskLevel: overallLevel,
				score: overallScore,
				changedFiles,
				missingCoChangedFiles,
				suggestedTests: [],
				summary: `Analyzed ${fileAnalyses.length} files. Overall risk: ${overallScore}/100 (${overallLevel}).`,
				rawResult: { fileAnalyses: fileAnalyses.slice(0, 20) },
				commentPosted: true,
				commentUrl: comment.html_url,
				durationMs,
			});

			// 11. Update file risk stats
			const today = new Date().toISOString().split("T")[0];
			for (const file of fileAnalyses) {
				await ctx.runMutation(api.analyses.updateFileRisk, {
					repoId: repo._id,
					filePath: file.file,
					riskLevel: file.riskLevel === "critical" ? "high" : file.riskLevel,
				});
			}

			// 12. Bump daily stats
			await ctx.runMutation(api.analyses.bumpDailyStats, {
				orgId: repo.orgId,
				repoId: repo._id,
				date: today,
				riskLevel: overallLevel,
				riskScore: overallScore,
			});

			console.log(`Analysis complete for PR #${args.prNumber}: ${overallScore}/100 (${overallLevel})`);

			return {
				success: true,
				analysisId,
				riskScore: overallScore,
				riskLevel: overallLevel,
				filesAnalyzed: fileAnalyses.length,
				commentUrl: comment.html_url,
			};
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			console.error("PR analysis failed:", errorMessage);
			return { success: false, error: errorMessage };
		} finally {
			// Cleanup temp directory
			if (tempDir) {
				await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
			}
		}
	},
});
