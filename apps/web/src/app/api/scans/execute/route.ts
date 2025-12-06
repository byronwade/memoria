import { NextRequest, NextResponse } from "next/server";
import { getConvexClient, callMutation, callQuery } from "@/lib/convex";
import { getInstallationToken } from "@/lib/github/auth";
import simpleGit from "simple-git";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import ignore from "ignore";

// Internal API key for server-to-server auth
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "memoria-internal";

// Source code file extensions to analyze
const SOURCE_EXTENSIONS = new Set([
	".ts",
	".tsx",
	".js",
	".jsx",
	".py",
	".go",
	".rs",
	".java",
	".kt",
	".rb",
	".php",
	".c",
	".cpp",
	".h",
	".hpp",
	".cs",
	".swift",
	".m",
	".mm",
]);

// Universal ignore patterns
const UNIVERSAL_IGNORE_PATTERNS = [
	"node_modules/",
	"package-lock.json",
	"yarn.lock",
	"pnpm-lock.yaml",
	"dist/",
	"build/",
	".next/",
	".nuxt/",
	".cache/",
	"coverage/",
	"__pycache__/",
	"*.pyc",
	"venv/",
	".venv/",
	"target/",
	"*.class",
	".gradle/",
	"vendor/",
	"Cargo.lock",
	"Gemfile.lock",
	".bundle/",
	"bin/",
	"obj/",
	".git/",
	".svn/",
	"*.log",
	"logs/",
	".idea/",
	".vscode/",
];

// Panic keywords for volatility scoring (weight: 0.5-3)
const PANIC_KEYWORDS: Record<string, number> = {
	security: 3,
	vulnerability: 3,
	crash: 3,
	"data loss": 3,
	revert: 2,
	hotfix: 2,
	breaking: 2,
	critical: 2,
	fix: 1,
	bug: 1,
	patch: 1,
	error: 1,
	refactor: 0.5,
	cleanup: 0.5,
};

interface FileAnalysisResult {
	filePath: string;
	riskScore: number;
	riskLevel: "low" | "medium" | "high" | "critical";
	volatilityScore: number;
	couplingScore: number;
	driftScore: number;
	importerCount: number;
	coupledFiles: Array<{ file: string; score: number; changeType: string }>;
	staticDependents: string[];
}

/**
 * POST /api/scans/execute
 * Execute a repository scan (called by Convex action or directly)
 */
export async function POST(request: NextRequest) {
	// Verify internal API key
	const apiKey = request.headers.get("X-Internal-Key");
	if (apiKey !== INTERNAL_API_KEY) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const body = await request.json();
	const { scanId, repositoryId, installationId, fullName } = body;

	if (!scanId || !repositoryId || !installationId || !fullName) {
		return NextResponse.json(
			{ error: "Missing required parameters" },
			{ status: 400 }
		);
	}

	const convex = getConvexClient();

	// Create temp directory for cloning
	const tempDir = path.join(os.tmpdir(), `memoria-scan-${Date.now()}`);

	try {
		// Update status to running
		await callMutation(convex, "scans:updateScanProgress", {
			scanId,
			status: "running",
		});

		// Get installation token for cloning
		const token = await getInstallationToken(parseInt(installationId));

		// Clone repository
		await fs.mkdir(tempDir, { recursive: true });
		const git = simpleGit(tempDir);

		const cloneUrl = `https://x-access-token:${token}@github.com/${fullName}.git`;
		await git.clone(cloneUrl, tempDir, ["--depth", "1"]);

		// Get list of source files
		const files = await getSourceFiles(tempDir);

		// Update total files count
		await callMutation(convex, "scans:updateScanProgress", {
			scanId,
			totalFiles: files.length,
		});

		// Analyze files in batches
		const BATCH_SIZE = 10;
		let processedFiles = 0;
		let filesWithRisk = 0;
		const allAnalyses: FileAnalysisResult[] = [];

		for (let i = 0; i < files.length; i += BATCH_SIZE) {
			const batch = files.slice(i, i + BATCH_SIZE);

			// Analyze each file in the batch
			const batchResults = await Promise.all(
				batch.map((file) => analyzeFile(tempDir, file, git))
			);

			// Filter out nulls and collect results
			for (const result of batchResults) {
				if (result) {
					allAnalyses.push(result);
					if (result.riskScore >= 25) {
						filesWithRisk++;
					}
				}
				processedFiles++;
			}

			// Store batch results
			if (batchResults.filter(Boolean).length > 0) {
				await callMutation(convex, "scans:batchStoreFileAnalyses", {
					scanId,
					repositoryId,
					analyses: batchResults.filter(Boolean) as FileAnalysisResult[],
				});
			}

			// Update progress
			await callMutation(convex, "scans:updateScanProgress", {
				scanId,
				processedFiles,
				filesWithRisk,
			});
		}

		// Mark scan as completed
		await callMutation(convex, "scans:updateScanProgress", {
			scanId,
			status: "completed",
		});

		return NextResponse.json({
			success: true,
			message: "Scan completed",
			totalFiles: files.length,
			filesWithRisk,
		});
	} catch (error) {
		console.error("Scan execution failed:", error);

		// Mark scan as failed
		await callMutation(convex, "scans:updateScanProgress", {
			scanId,
			status: "failed",
			errorMessage: error instanceof Error ? error.message : "Unknown error",
		});

		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Scan failed" },
			{ status: 500 }
		);
	} finally {
		// Cleanup temp directory
		try {
			await fs.rm(tempDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	}
}

/**
 * Get list of source files in the repository
 */
async function getSourceFiles(repoPath: string): Promise<string[]> {
	const ig = ignore();
	ig.add(UNIVERSAL_IGNORE_PATTERNS);

	// Try to read .gitignore
	try {
		const gitignorePath = path.join(repoPath, ".gitignore");
		const gitignoreContent = await fs.readFile(gitignorePath, "utf8");
		ig.add(gitignoreContent);
	} catch {
		// .gitignore doesn't exist
	}

	const files: string[] = [];

	async function walkDir(dir: string) {
		const entries = await fs.readdir(dir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);
			const relativePath = path.relative(repoPath, fullPath);

			// Skip ignored paths
			if (ig.ignores(relativePath)) continue;

			if (entry.isDirectory()) {
				await walkDir(fullPath);
			} else if (entry.isFile()) {
				const ext = path.extname(entry.name).toLowerCase();
				if (SOURCE_EXTENSIONS.has(ext)) {
					files.push(relativePath);
				}
			}
		}
	}

	await walkDir(repoPath);
	return files;
}

/**
 * Analyze a single file
 */
async function analyzeFile(
	repoPath: string,
	relativePath: string,
	git: ReturnType<typeof simpleGit>
): Promise<FileAnalysisResult | null> {
	try {
		const fullPath = path.join(repoPath, relativePath);

		// Get volatility (commit history analysis)
		const volatility = await getFileVolatility(fullPath, git);

		// Get coupled files (co-change analysis)
		const coupled = await getCoupledFiles(relativePath, git, repoPath);

		// Get static importers
		const importers = await getFileImporters(relativePath, git, repoPath);

		// Calculate compound risk score
		const riskScore = calculateRiskScore(
			volatility.panicScore,
			coupled,
			importers.length
		);

		// Determine risk level
		let riskLevel: "low" | "medium" | "high" | "critical";
		if (riskScore >= 75) riskLevel = "critical";
		else if (riskScore >= 50) riskLevel = "high";
		else if (riskScore >= 25) riskLevel = "medium";
		else riskLevel = "low";

		return {
			filePath: relativePath,
			riskScore,
			riskLevel,
			volatilityScore: volatility.panicScore,
			couplingScore:
				coupled.length > 0
					? Math.round(coupled.reduce((sum, c) => sum + c.score, 0) / coupled.length)
					: 0,
			driftScore: 0, // Would need mtime comparison with coupled files
			importerCount: importers.length,
			coupledFiles: coupled.map((c) => ({
				file: c.file,
				score: c.score,
				changeType: "unknown",
			})),
			staticDependents: importers,
		};
	} catch (error) {
		console.error(`Failed to analyze ${relativePath}:`, error);
		return null;
	}
}

/**
 * Get file volatility from commit history
 */
async function getFileVolatility(
	filePath: string,
	git: ReturnType<typeof simpleGit>
): Promise<{ panicScore: number; commitCount: number }> {
	try {
		const log = await git.log({ file: filePath, maxCount: 20 });

		if (log.total === 0) {
			return { panicScore: 0, commitCount: 0 };
		}

		let weightedScore = 0;
		const maxScore = 20 * 3; // 20 commits * max weight

		for (const commit of log.all) {
			const msg = commit.message.toLowerCase();
			let commitWeight = 0;

			for (const [keyword, weight] of Object.entries(PANIC_KEYWORDS)) {
				if (msg.includes(keyword)) {
					commitWeight = Math.max(commitWeight, weight);
				}
			}

			// Apply time decay (risk drops by 50% every 30 days)
			const commitDate = new Date(commit.date);
			const daysAgo = (Date.now() - commitDate.getTime()) / (1000 * 60 * 60 * 24);
			const decay = Math.pow(0.5, daysAgo / 30);

			weightedScore += commitWeight * decay;
		}

		return {
			panicScore: Math.min(100, Math.round((weightedScore / maxScore) * 100)),
			commitCount: log.total,
		};
	} catch {
		return { panicScore: 0, commitCount: 0 };
	}
}

/**
 * Get files that frequently change together with this file
 */
async function getCoupledFiles(
	relativePath: string,
	git: ReturnType<typeof simpleGit>,
	repoPath: string
): Promise<Array<{ file: string; score: number }>> {
	try {
		const log = await git.log({ file: relativePath, maxCount: 50 });

		if (log.total < 3) {
			return []; // Not enough history for meaningful coupling
		}

		const couplingMap: Record<string, number> = {};

		for (const commit of log.all) {
			const show = await git.show([commit.hash, "--name-only", "--format="]);
			const files = show
				.split("\n")
				.map((f) => f.trim())
				.filter((f) => f && f !== relativePath);

			// Skip large commits (likely refactors)
			if (files.length > 15) continue;

			for (const file of files) {
				couplingMap[file] = (couplingMap[file] || 0) + 1;
			}
		}

		// Calculate coupling scores and filter
		const threshold = 15; // Minimum coupling percentage
		return Object.entries(couplingMap)
			.map(([file, count]) => ({
				file,
				score: Math.round((count / log.total) * 100),
			}))
			.filter((c) => c.score >= threshold)
			.sort((a, b) => b.score - a.score)
			.slice(0, 5);
	} catch {
		return [];
	}
}

/**
 * Get files that import this file
 */
async function getFileImporters(
	relativePath: string,
	git: ReturnType<typeof simpleGit>,
	repoPath: string
): Promise<string[]> {
	try {
		const fileName = path.basename(relativePath, path.extname(relativePath));
		const importPattern = `(import|from|require).*['"].*${fileName}`;

		const result = await git
			.raw(["grep", "-l", "-E", "--", importPattern])
			.catch(() => "");

		return result
			.split("\n")
			.map((f) => f.trim())
			.filter((f) => f && f !== relativePath);
	} catch {
		return [];
	}
}

/**
 * Calculate compound risk score
 */
function calculateRiskScore(
	volatilityScore: number,
	coupled: Array<{ score: number }>,
	importerCount: number
): number {
	const VOLATILITY_WEIGHT = 0.35;
	const COUPLING_WEIGHT = 0.3;
	const DRIFT_WEIGHT = 0.2;
	const IMPORTER_WEIGHT = 0.15;

	// Coupling component
	const couplingScores = coupled.slice(0, 3).map((c) => c.score);
	const couplingComponent =
		couplingScores.length > 0
			? Math.min(
					100,
					(couplingScores.reduce((a, b) => a + b, 0) / couplingScores.length) * 1.5
				)
			: 0;

	// Importer component
	const importerComponent = Math.min(100, importerCount * 10);

	// Calculate compound score
	return Math.round(
		volatilityScore * VOLATILITY_WEIGHT +
			couplingComponent * COUPLING_WEIGHT +
			0 * DRIFT_WEIGHT + // Drift not calculated in initial scan
			importerComponent * IMPORTER_WEIGHT
	);
}
