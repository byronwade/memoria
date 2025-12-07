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
		// Need enough history for coupling analysis (200 commits)
		// but not full clone which would be slow
		await git.clone(cloneUrl, tempDir, ["--depth", "200", "--single-branch"]);

		// Get list of source files
		const files = await getSourceFiles(tempDir);

		// Update total files count
		await callMutation(convex, "scans:updateScanProgress", {
			scanId,
			totalFiles: files.length,
		});

		// Pre-compute ALL analysis data in just 2 git commands total
		// This replaces hundreds of per-file git commands
		const [couplingCache, volatilityCache] = await Promise.all([
			preComputeCoupling(git),
			preComputeVolatility(git),
		]);

		// Analyze files in batches (much faster now - no git commands per file)
		const BATCH_SIZE = 50; // Can handle much larger batches now
		let processedFiles = 0;
		let filesWithRisk = 0;
		const allAnalyses: FileAnalysisResult[] = [];

		for (let i = 0; i < files.length; i += BATCH_SIZE) {
			const batch = files.slice(i, i + BATCH_SIZE);

			// Analyze each file in the batch (now synchronous - no git commands)
			const batchResults = batch.map((file) =>
				analyzeFileFromCache(file, couplingCache, volatilityCache)
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

		// Mark scan as completed and update repository lastAnalyzedAt
		await callMutation(convex, "scans:updateScanProgress", {
			scanId,
			repositoryId,
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
			repositoryId,
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
 * Analyze a single file from pre-computed caches (NO git commands)
 */
function analyzeFileFromCache(
	relativePath: string,
	couplingCache: Map<string, Map<string, number>>,
	volatilityCache: Map<string, { panicScore: number; commitCount: number }>
): FileAnalysisResult | null {
	try {
		// Get volatility from pre-computed cache (instant)
		const volatility = getVolatilityFromCache(relativePath, volatilityCache);

		// Get coupled files from pre-computed cache (instant)
		const coupled = getCoupledFilesFromCache(relativePath, couplingCache);

		// Skip importers for now - too slow. Can add back with pre-computation later
		const importers: string[] = [];

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
 * Pre-compute volatility data for all files in ONE git command
 */
async function preComputeVolatility(
	git: ReturnType<typeof simpleGit>
): Promise<Map<string, { panicScore: number; commitCount: number }>> {
	const fileVolatility = new Map<string, { panicScore: number; commitCount: number }>();
	const fileScores = new Map<string, { weightedScore: number; commitCount: number }>();

	try {
		// Get last 200 commits with files and messages in ONE command
		const log = await git.raw([
			"log",
			"--name-only",
			"--format=%H|%aI|%s",
			"-n",
			"200",
		]);

		let currentCommit: { date: Date; message: string } | null = null;

		for (const line of log.split("\n")) {
			const trimmed = line.trim();
			if (!trimmed) continue;

			// Check if it's a commit line (hash|date|message)
			if (trimmed.includes("|") && /^[a-f0-9]{40}\|/.test(trimmed)) {
				const parts = trimmed.split("|");
				currentCommit = {
					date: new Date(parts[1]),
					message: parts.slice(2).join("|").toLowerCase(),
				};
				continue;
			}

			// It's a file path
			if (currentCommit) {
				const file = trimmed;
				let commitWeight = 0;

				for (const [keyword, weight] of Object.entries(PANIC_KEYWORDS)) {
					if (currentCommit.message.includes(keyword)) {
						commitWeight = Math.max(commitWeight, weight);
					}
				}

				// Apply time decay
				const daysAgo = (Date.now() - currentCommit.date.getTime()) / (1000 * 60 * 60 * 24);
				const decay = Math.pow(0.5, daysAgo / 30);

				const existing = fileScores.get(file) || { weightedScore: 0, commitCount: 0 };
				fileScores.set(file, {
					weightedScore: existing.weightedScore + commitWeight * decay,
					commitCount: existing.commitCount + 1,
				});
			}
		}

		// Convert to panic scores
		const maxScore = 20 * 3;
		for (const [file, data] of fileScores) {
			fileVolatility.set(file, {
				panicScore: Math.min(100, Math.round((data.weightedScore / maxScore) * 100)),
				commitCount: Math.min(data.commitCount, 20),
			});
		}
	} catch (error) {
		console.error("Failed to pre-compute volatility:", error);
	}

	return fileVolatility;
}

/**
 * Get volatility from pre-computed cache
 */
function getVolatilityFromCache(
	relativePath: string,
	volatilityCache: Map<string, { panicScore: number; commitCount: number }>
): { panicScore: number; commitCount: number } {
	return volatilityCache.get(relativePath) || { panicScore: 0, commitCount: 0 };
}

/**
 * Pre-compute coupling data for all files in one pass.
 * This is MUCH faster than per-file git log + git show.
 */
async function preComputeCoupling(
	git: ReturnType<typeof simpleGit>
): Promise<Map<string, Map<string, number>>> {
	const fileCouplingMap = new Map<string, Map<string, number>>();
	const fileCommitCounts = new Map<string, number>();

	try {
		// Get last 200 commits with their files in ONE command
		const log = await git.raw([
			"log",
			"--name-only",
			"--format=%H",
			"-n",
			"200",
		]);

		let currentFiles: string[] = [];

		for (const line of log.split("\n")) {
			const trimmed = line.trim();
			if (!trimmed) {
				// End of commit block - process files
				if (currentFiles.length > 1 && currentFiles.length <= 15) {
					for (const file of currentFiles) {
						fileCommitCounts.set(file, (fileCommitCounts.get(file) || 0) + 1);
						if (!fileCouplingMap.has(file)) {
							fileCouplingMap.set(file, new Map());
						}
						const coupling = fileCouplingMap.get(file)!;
						for (const other of currentFiles) {
							if (other !== file) {
								coupling.set(other, (coupling.get(other) || 0) + 1);
							}
						}
					}
				}
				currentFiles = [];
				continue;
			}

			// Skip commit hashes (40 hex chars)
			if (/^[a-f0-9]{40}$/i.test(trimmed)) {
				continue;
			}
			currentFiles.push(trimmed);
		}

		// Convert counts to percentages
		for (const [file, coupling] of fileCouplingMap) {
			const totalCommits = fileCommitCounts.get(file) || 1;
			for (const [other, count] of coupling) {
				coupling.set(other, Math.round((count / totalCommits) * 100));
			}
		}
	} catch (error) {
		console.error("Failed to pre-compute coupling:", error);
	}

	return fileCouplingMap;
}

/**
 * Get coupled files from pre-computed data
 */
function getCoupledFilesFromCache(
	relativePath: string,
	couplingCache: Map<string, Map<string, number>>
): Array<{ file: string; score: number }> {
	const coupling = couplingCache.get(relativePath);
	if (!coupling) return [];

	const threshold = 15;
	return Array.from(coupling.entries())
		.map(([file, score]) => ({ file, score }))
		.filter((c) => c.score >= threshold)
		.sort((a, b) => b.score - a.score)
		.slice(0, 5);
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
