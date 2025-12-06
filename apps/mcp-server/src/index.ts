#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	CallToolRequestSchema,
	GetPromptRequestSchema,
	ListPromptsRequestSchema,
	ListResourcesRequestSchema,
	ListToolsRequestSchema,
	ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import ignore from "ignore";
import { LRUCache } from "lru-cache";
import simpleGit from "simple-git";
import { z } from "zod";

// --- CONFIGURATION & CACHE ---
// Cache results for 5 minutes
export const cache = new LRUCache<string, any>({
	max: 100,
	ttl: 1000 * 60 * 5,
});

// --- CONFIGURATION SCHEMA (.memoria.json) ---
const MemoriaConfigSchema = z
	.object({
		thresholds: z
			.object({
				couplingPercent: z.number().min(0).max(100).optional(),
				driftDays: z.number().min(1).max(365).optional(),
				analysisWindow: z.number().min(10).max(500).optional(),
				maxFilesPerCommit: z.number().min(5).max(100).optional(),
			})
			.optional(),
		ignore: z.array(z.string()).optional(),
		panicKeywords: z.record(z.string(), z.number()).optional(),
		riskWeights: z
			.object({
				volatility: z.number().min(0).max(1).optional(),
				coupling: z.number().min(0).max(1).optional(),
				drift: z.number().min(0).max(1).optional(),
				importers: z.number().min(0).max(1).optional(),
			})
			.optional(),
	})
	.strict();

export type MemoriaConfig = z.infer<typeof MemoriaConfigSchema>;

// Export configSchema for Smithery
export const configSchema = z.object({
	couplingPercent: z
		.number()
		.min(0)
		.max(100)
		.optional()
		.default(15)
		.describe("Minimum coupling percentage to report (0-100)"),
	driftDays: z
		.number()
		.min(1)
		.max(365)
		.optional()
		.default(7)
		.describe("Days before a coupled file is considered stale"),
	analysisWindow: z
		.number()
		.min(10)
		.max(500)
		.optional()
		.default(50)
		.describe("Number of commits to analyze for coupling"),
});

// Load and validate .memoria.json config file (cached)
export async function loadConfig(
	repoRoot: string,
): Promise<MemoriaConfig | null> {
	const cacheKey = `config:${repoRoot}`;
	if (cache.has(cacheKey)) return cache.get(cacheKey);

	try {
		const configPath = path.join(repoRoot, ".memoria.json");
		const content = await fs.readFile(configPath, "utf8");
		const parsed = JSON.parse(content);
		const validated = MemoriaConfigSchema.parse(parsed);
		cache.set(cacheKey, validated);
		return validated;
	} catch (_e) {
		// Config doesn't exist or is invalid - use defaults
		cache.set(cacheKey, null);
		return null;
	}
}

// Get effective panic keywords (base + config overrides)
export function getEffectivePanicKeywords(
	config: MemoriaConfig | null | undefined,
): Record<string, number> {
	if (!config?.panicKeywords) return PANIC_KEYWORDS;
	return { ...PANIC_KEYWORDS, ...config.panicKeywords };
}

// Get effective risk weights (base + config overrides)
export function getEffectiveRiskWeights(
	config: MemoriaConfig | null | undefined,
): {
	volatility: number;
	coupling: number;
	drift: number;
	importers: number;
} {
	const defaults = {
		volatility: 0.35,
		coupling: 0.3,
		drift: 0.2,
		importers: 0.15,
	};
	if (!config?.riskWeights) return defaults;
	return {
		volatility: config.riskWeights.volatility ?? defaults.volatility,
		coupling: config.riskWeights.coupling ?? defaults.coupling,
		drift: config.riskWeights.drift ?? defaults.drift,
		importers: config.riskWeights.importers ?? defaults.importers,
	};
}

// --- TYPES ---
export type ChangeType =
	| "schema"
	| "api"
	| "config"
	| "import"
	| "test"
	| "style"
	| "unknown";

export interface DiffSummary {
	additions: string[]; // Lines added (max 10)
	removals: string[]; // Lines removed (max 10)
	hunks: number; // Number of change hunks (complexity indicator)
	netChange: number; // additions - removals
	hasBreakingChange: boolean; // Detected breaking patterns
	changeType: ChangeType; // Classified relationship type
}

export interface RiskAssessment {
	score: number; // 0-100 compound risk score
	level: "low" | "medium" | "high" | "critical";
	factors: string[]; // Human-readable risk factors
	action: string; // Recommended action
}

// --- COUPLING SOURCE TYPES (for multi-engine coupling detection) ---
export type CouplingSource =
	| "git" // Engine 2: Co-change correlation from git history
	| "docs" // Engine 6: Documentation references
	| "type" // Engine 7: Shared type definitions
	| "content" // Engine 8: Shared string literals
	| "test" // Engine 9: Test file coupling
	| "env" // Engine 10: Environment variable coupling
	| "schema" // Engine 11: Database schema coupling
	| "api" // Engine 12: API endpoint coupling
	| "transitive"; // Engine 13: Re-export chain coupling

export interface EnhancedCoupledFile {
	file: string;
	score: number;
	source: CouplingSource;
	reason: string;
	evidence?: DiffSummary | string;
	lastHash?: string;
}

// --- ANALYSIS CONTEXT (Shared across all engines to avoid redundant initialization) ---
// Note: AnalysisContext uses ProjectMetrics defined below in the "PROJECT METRICS" section
export interface AnalysisContext {
	targetPath: string; // Absolute path to the file being analyzed
	repoRoot: string; // Git repository root directory
	git: ReturnType<typeof simpleGit>; // Shared git instance
	config: MemoriaConfig | null; // Loaded .memoria.json config
	ig: ReturnType<typeof ignore>; // Ignore filter instance
	metrics: {
		// Inline type to avoid circular dependency
		totalCommits: number;
		commitsPerWeek: number;
		avgFilesPerCommit: number;
	};
}

// --- AUTHOR CONTRIBUTION (Bus Factor) ---
export interface AuthorContribution {
	name: string;
	email: string;
	commits: number;
	percentage: number;
	firstCommit: string; // ISO date
	lastCommit: string; // ISO date
}

// --- VOLATILITY RESULT (with time decay and author details) ---
export interface VolatilityResult {
	// Existing fields (backward compatible)
	commitCount: number;
	panicScore: number; // 0-100, now with time decay
	panicCommits: string[]; // Top 3 concerning commits
	lastCommitDate: string | undefined;
	authors: number; // Backward compatible count
	// NEW fields
	authorDetails: AuthorContribution[]; // Full author breakdown
	topAuthor: AuthorContribution | null; // Bus factor indicator
	recencyDecay: {
		oldestCommitDays: number;
		newestCommitDays: number;
		decayFactor: number; // Average decay multiplier applied
	};
}

// --- PANIC KEYWORDS WITH SEVERITY WEIGHTS ---
export const PANIC_KEYWORDS: Record<string, number> = {
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
// Calculate time-decay factor: risk drops by 50% every 30 days
export function calculateRecencyDecay(commitDate: Date): number {
	const now = Date.now();
	const daysAgo = Math.floor(
		(now - commitDate.getTime()) / (1000 * 60 * 60 * 24),
	);
	return 0.5 ** (daysAgo / 30);
}

// --- CONCURRENCY LIMITER ---
// Prevents "Too many open files" errors by limiting parallel async operations
// IMPORTANT: Preserves order - results[i] corresponds to items[i]
export async function mapConcurrent<T, R>(
	items: readonly T[],
	limit: number,
	fn: (item: T) => Promise<R>,
): Promise<R[]> {
	const results: R[] = new Array(items.length);
	const executing: Promise<void>[] = [];

	for (let i = 0; i < items.length; i++) {
		const index = i; // Capture index for closure
		const p = Promise.resolve()
			.then(() => fn(items[index]))
			.then((r) => {
				results[index] = r; // Store at correct index to preserve order
			});
		const e: Promise<void> = p.then(() => {
			executing.splice(executing.indexOf(e), 1);
		});
		executing.push(e);
		if (executing.length >= limit) await Promise.race(executing);
	}
	await Promise.all(executing);
	return results;
}

// --- RELATIONSHIP-SPECIFIC INSTRUCTIONS ---
export const RELATIONSHIP_INSTRUCTIONS: Record<ChangeType, string> = {
	schema:
		"These files share type definitions. If you modify types in one, update the other to match.",
	api: "These files share an API contract. Signature changes require updates to both caller and callee.",
	config:
		"These files share configuration. Ensure config keys match between files.",
	import:
		"These files have import dependencies. Check for circular imports or missing exports.",
	test: "This is a test file coupling. Ensure test mocks/fixtures still match the implementation.",
	style:
		"These files had formatting changes together. Likely coincidental - verify actual relationship.",
	unknown:
		"Relationship unclear. Manually verify if changes to one require changes to the other.",
};

// --- PRE-COMPILED REGEX PATTERNS FOR CHANGE CLASSIFICATION ---
// Compiled once at module load instead of on every classifyChangeType() call
export const CHANGE_TYPE_PATTERNS = {
	schema: [
		/\b(interface|type|schema|class|struct|enum)\b/,
		/:\s*(string|number|boolean|Date|any|null|undefined)\b/,
		/\b(extends|implements)\b/,
	],
	api: [
		/\b(function|async|export\s+(const|function|class)|def\s+\w+|func\s+\w+)\b/,
		/\b(return|throw|await|yield)\b/,
		/=>\s*[{(]/,
	],
	import: [/^(import|export\s+\*|from\s+['"]|require\s*\()/m],
	config: [
		/\b(config|env|setting|option|constant|CONFIG|ENV)\b/i,
		/^[A-Z][A-Z_0-9]+\s*[:=]/,
		/\.(json|yaml|yml|toml|ini|env)/,
	],
	test: [
		/\b(describe|it|test|expect|mock|jest|vitest|pytest|spec)\b/,
		/\.(test|spec)\.(ts|js|tsx|jsx)/,
	],
} as const;

// Pre-compiled regex for test file suffix detection (used in getSiblingGuidance)
export const TEST_SUFFIX_REGEX = /\.(test|spec)$|-(test|spec)$|_(test|spec)$/;

// Helper: Generate stable cache key from config (deterministic string instead of JSON.stringify)
export function getStableConfigKey(
	config: MemoriaConfig | null | undefined,
): string {
	if (!config) return "";
	const parts: string[] = [];
	// Thresholds (include all three: couplingPercent, driftDays, analysisWindow)
	if (config.thresholds) {
		parts.push(`cp${config.thresholds.couplingPercent ?? "x"}`);
		parts.push(`dd${config.thresholds.driftDays ?? "x"}`);
		parts.push(`aw${config.thresholds.analysisWindow ?? "x"}`);
	}
	// Ignore patterns count
	if (config.ignore?.length) {
		parts.push(`ig${config.ignore.length}`);
	}
	// Panic keywords (sorted keys for consistency)
	if (config.panicKeywords) {
		const sortedKeys = Object.keys(config.panicKeywords).sort();
		parts.push(`pk${sortedKeys.join("-")}`);
	}
	return parts.join("_");
}

// Universal ignore patterns covering multiple languages and ecosystems
export const UNIVERSAL_IGNORE_PATTERNS = [
	// JavaScript/Node.js
	"node_modules/",
	"package-lock.json",
	"yarn.lock",
	"pnpm-lock.yaml",
	"npm-debug.log",
	"dist/",
	"build/",
	".next/",
	".nuxt/",
	".cache/",
	"coverage/",

	// Python
	"__pycache__/",
	"*.pyc",
	"*.pyo",
	"*.pyd",
	".Python",
	"venv/",
	".venv/",
	"env/",
	"pip-log.txt",
	".pytest_cache/",
	".mypy_cache/",
	"*.egg-info/",
	".tox/",

	// Java/Kotlin
	"target/",
	"*.class",
	"*.jar",
	"*.war",
	".gradle/",
	"build/",
	".mvn/",

	// C/C++
	"*.o",
	"*.obj",
	"*.exe",
	"*.dll",
	"*.so",
	"*.dylib",
	"*.a",
	"*.lib",

	// Rust
	"target/",
	"Cargo.lock",

	// Go
	"vendor/",
	"*.test",
	"*.out",

	// Ruby
	"Gemfile.lock",
	".bundle/",
	"vendor/bundle/",

	// PHP
	"vendor/",
	"composer.lock",

	// .NET
	"bin/",
	"obj/",
	"*.dll",
	"*.exe",
	"*.pdb",

	// Build outputs (general)
	"out/",
	"output/",
	"release/",
	"debug/",

	// IDE/Editor files
	".vscode/",
	".idea/",
	"*.swp",
	"*.swo",
	"*~",
	".DS_Store",
	"Thumbs.db",

	// VCS
	".git/",
	".svn/",
	".hg/",

	// Logs
	"*.log",
	"logs/",
];

// --- PROJECT METRICS & ADAPTIVE THRESHOLDS ---

export interface ProjectMetrics {
	totalCommits: number;
	commitsPerWeek: number;
	avgFilesPerCommit: number;
}

export interface AdaptiveThresholds {
	couplingThreshold: number; // Minimum % to consider files coupled
	driftDays: number; // Days before a coupled file is "stale"
	analysisWindow: number; // Number of commits to analyze
}

// Get project velocity metrics (cached)
export async function getProjectMetrics(
	repoRoot: string,
): Promise<ProjectMetrics> {
	const cacheKey = `project-metrics:${repoRoot}`;
	if (cache.has(cacheKey)) return cache.get(cacheKey);

	try {
		const git = simpleGit(repoRoot);

		// Get commits from last 30 days
		const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
			.toISOString()
			.split("T")[0];
		const log = await git.log({ "--since": thirtyDaysAgo, maxCount: 500 });

		const totalCommits = log.total;
		const commitsPerWeek = (totalCommits / 30) * 7;

		// Sample up to 10 commits to estimate files per commit (parallelized for performance)
		const sampleCommits = log.all.slice(0, 10);
		const showResults = await mapConcurrent(sampleCommits, 5, (commit) =>
			git.show([commit.hash, "--name-only", "--format="]).catch(() => ""),
		);
		const totalFiles = showResults.reduce(
			(sum, show) => sum + show.split("\n").filter((f) => f.trim()).length,
			0,
		);
		const avgFilesPerCommit =
			sampleCommits.length > 0 ? totalFiles / sampleCommits.length : 3;

		const metrics: ProjectMetrics = {
			totalCommits,
			commitsPerWeek,
			avgFilesPerCommit,
		};
		cache.set(cacheKey, metrics);
		return metrics;
	} catch {
		// Return default metrics on error
		return { totalCommits: 0, commitsPerWeek: 10, avgFilesPerCommit: 3 };
	}
}

// Calculate thresholds based on project velocity and config overrides
export function getAdaptiveThresholds(
	metrics: ProjectMetrics,
	config?: MemoriaConfig | null,
): AdaptiveThresholds {
	// Base thresholds
	let couplingThreshold = 15;
	let driftDays = 7;
	let analysisWindow = 50;

	// Adjust based on commit velocity
	if (metrics.commitsPerWeek < 5) {
		// Low velocity project: stricter coupling, longer drift window
		couplingThreshold = 20;
		driftDays = 14;
		analysisWindow = 30;
	} else if (metrics.commitsPerWeek > 50) {
		// High velocity project: looser coupling (more noise), shorter drift window
		couplingThreshold = 10;
		driftDays = 3;
		analysisWindow = 100;
	}

	// Adjust for commit size (large atomic commits = more noise)
	if (metrics.avgFilesPerCommit > 5) {
		couplingThreshold += 5;
	}

	// Apply config overrides (if provided)
	if (config?.thresholds) {
		if (config.thresholds.couplingPercent !== undefined) {
			couplingThreshold = config.thresholds.couplingPercent;
		}
		if (config.thresholds.driftDays !== undefined) {
			driftDays = config.thresholds.driftDays;
		}
		if (config.thresholds.analysisWindow !== undefined) {
			analysisWindow = config.thresholds.analysisWindow;
		}
	}

	return { couplingThreshold, driftDays, analysisWindow };
}

// --- DIFF PARSING & CLASSIFICATION ---

// Classify what type of change the diff represents
// Uses pre-compiled regex patterns from CHANGE_TYPE_PATTERNS for performance
export function classifyChangeType(
	additions: string[],
	removals: string[],
): ChangeType {
	const all = [...additions, ...removals].join("\n");

	// Schema/Type changes (interfaces, types, classes, field definitions)
	if (CHANGE_TYPE_PATTERNS.schema.some((pattern) => pattern.test(all))) {
		return "schema";
	}

	// API/Function signature changes
	if (CHANGE_TYPE_PATTERNS.api.some((pattern) => pattern.test(all))) {
		return "api";
	}

	// Import/Export changes
	if (CHANGE_TYPE_PATTERNS.import.some((pattern) => pattern.test(all))) {
		return "import";
	}

	// Config changes
	if (CHANGE_TYPE_PATTERNS.config.some((pattern) => pattern.test(all))) {
		return "config";
	}

	// Test changes
	if (CHANGE_TYPE_PATTERNS.test.some((pattern) => pattern.test(all))) {
		return "test";
	}

	// Style changes (pure formatting - additions equal removals with only whitespace diff)
	if (additions.length === removals.length && additions.length > 0) {
		const isStyleOnly = additions.every((a, i) => {
			const removal = removals[i];
			return removal && a.replace(/\s/g, "") === removal.replace(/\s/g, "");
		});
		if (isStyleOnly) return "style";
	}

	return "unknown";
}

// Parse raw git diff into structured summary
export function parseDiffToSummary(rawDiff: string): DiffSummary {
	// Handle binary files gracefully
	if (rawDiff === "[Binary file]" || rawDiff.includes("Binary files")) {
		return {
			additions: [],
			removals: [],
			hunks: 0,
			netChange: 0,
			hasBreakingChange: false,
			changeType: "unknown",
		};
	}

	const lines = rawDiff.split("\n");
	const additions: string[] = [];
	const removals: string[] = [];
	let hunks = 0;

	for (const line of lines) {
		// Count hunk headers (@@...@@)
		if (line.startsWith("@@")) {
			hunks++;
		}
		// Additions (skip the +++ header line)
		else if (line.startsWith("+") && !line.startsWith("+++")) {
			const content = line.slice(1).trim();
			if (content) additions.push(content);
		}
		// Removals (skip the --- header line)
		else if (line.startsWith("-") && !line.startsWith("---")) {
			const content = line.slice(1).trim();
			if (content) removals.push(content);
		}
	}

	// Detect breaking changes
	const breakingPatterns = [
		/\b(remove|delete|deprecate)\b/i, // Removal keywords
		/^-\s*(export|public|module\.exports)/, // Removed exports
		/^-\s*(async\s+)?function\s+\w+/, // Removed functions
		/^-\s*(interface|type|class)\s+\w+/, // Removed type definitions
	];
	const hasBreakingChange = removals.some((r) =>
		breakingPatterns.some((p) => p.test(`-${r}`)),
	);

	// Classify the relationship type
	const changeType = classifyChangeType(additions, removals);

	// Calculate netChange BEFORE truncating arrays
	const netChange = additions.length - removals.length;

	return {
		additions: additions.slice(0, 10), // Limit to 10 most relevant
		removals: removals.slice(0, 10),
		hunks,
		netChange,
		hasBreakingChange,
		changeType,
	};
}

// Helper: Get a git instance for the specific file's directory
export function getGitForFile(filePath: string) {
	const dir = path.dirname(filePath);
	return simpleGit(dir);
}

// --- BINARY FILE DETECTION ---
// Known binary file extensions to skip during diff analysis
export const BINARY_EXTENSIONS = new Set([
	// Images
	".png",
	".jpg",
	".jpeg",
	".gif",
	".bmp",
	".ico",
	".webp",
	".svg",
	".tiff",
	".psd",
	// Documents
	".pdf",
	".doc",
	".docx",
	".xls",
	".xlsx",
	".ppt",
	".pptx",
	// Archives
	".zip",
	".tar",
	".gz",
	".rar",
	".7z",
	".bz2",
	// Fonts
	".woff",
	".woff2",
	".ttf",
	".eot",
	".otf",
	// Media
	".mp3",
	".mp4",
	".wav",
	".avi",
	".mov",
	".mkv",
	".flac",
	// Executables/Libraries
	".exe",
	".dll",
	".so",
	".dylib",
	".a",
	".lib",
	".o",
	".obj",
	// Other binary
	".bin",
	".dat",
	".db",
	".sqlite",
	".sqlite3",
]);

// Helper: Get the actual code diff for a specific file at a specific commit
export async function getDiffSnippet(
	repoRoot: string,
	relativeFilePath: string,
	commitHash: string,
): Promise<string> {
	// Check cache first
	const cacheKey = `diff:${repoRoot}:${relativeFilePath}:${commitHash}`;
	if (cache.has(cacheKey)) {
		return cache.get(cacheKey)!;
	}

	try {
		// Check for binary file extension first (fast path)
		const ext = path.extname(relativeFilePath).toLowerCase();
		if (BINARY_EXTENSIONS.has(ext)) {
			cache.set(cacheKey, "[Binary file]");
			return "[Binary file]";
		}

		const git = simpleGit(repoRoot);
		// Get the DIFF (changes made) for that file in that commit
		// Using -- separator to properly handle file paths
		const diff = await git.show([commitHash, "--", relativeFilePath]);

		// Check for git's binary file marker in the output
		// The marker format is "Binary files a/path and b/path differ" at start of line
		if (/^Binary files .+ differ$/m.test(diff)) {
			cache.set(cacheKey, "[Binary file]");
			return "[Binary file]";
		}

		// Extract just the diff portion (skip commit metadata)
		const diffStart = diff.indexOf("diff --git");
		const cleanDiff = diffStart > -1 ? diff.slice(diffStart) : diff;

		// Truncate if too large (save tokens, but keep enough for context)
		const maxLength = 1000;
		let result: string;
		if (cleanDiff.length > maxLength) {
			result = cleanDiff.slice(0, maxLength) + "\n...(truncated)";
		} else {
			result = cleanDiff;
		}

		cache.set(cacheKey, result);
		return result;
	} catch (e) {
		// File might not exist in that commit, or other git errors
		cache.set(cacheKey, "");
		return "";
	}
}

// Helper: Parse .gitignore and create ignore filter (with config patterns)
export async function getIgnoreFilter(
	repoRoot: string,
	config?: MemoriaConfig | null,
) {
	// Include config in cache key if patterns are specified
	const configPatterns = config?.ignore?.join(",") || "";
	const cacheKey = `gitignore:${repoRoot}:${configPatterns}`;
	if (cache.has(cacheKey)) return cache.get(cacheKey);

	const ig = ignore();

	// Add universal patterns first
	ig.add(UNIVERSAL_IGNORE_PATTERNS);

	// Try to read and add .gitignore patterns
	try {
		const gitignorePath = path.join(repoRoot, ".gitignore");
		const gitignoreContent = await fs.readFile(gitignorePath, "utf8");
		ig.add(gitignoreContent);
	} catch (_e) {
		// .gitignore doesn't exist or can't be read - that's okay, universal patterns still apply
	}

	// Add config-specified ignore patterns
	if (config?.ignore && config.ignore.length > 0) {
		ig.add(config.ignore);
	}

	cache.set(cacheKey, ig);
	return ig;
}

// Helper: Check if a file should be ignored
export function shouldIgnoreFile(
	filePath: string,
	ig: ReturnType<typeof ignore>,
) {
	// Normalize path for cross-platform compatibility
	const normalizedPath = filePath.replace(/\\/g, "/");
	return ig.ignores(normalizedPath);
}

// --- ANALYSIS CONTEXT FACTORY ---
// Create an AnalysisContext for a given file path (initializes git, config, etc. ONCE)
export async function createAnalysisContext(
	targetPath: string,
): Promise<AnalysisContext> {
	const git = getGitForFile(targetPath);
	const root = await git.revparse(["--show-toplevel"]);
	const repoRoot = root.trim();
	const config = await loadConfig(repoRoot);

	// getIgnoreFilter depends on config, but getProjectMetrics does not
	// Run them in parallel for faster context creation
	const [ig, metrics] = await Promise.all([
		getIgnoreFilter(repoRoot, config),
		getProjectMetrics(repoRoot),
	]);

	return {
		targetPath,
		repoRoot,
		git,
		config,
		ig,
		metrics,
	};
}

// --- ENGINE 1: ENTANGLEMENT (Enhanced with Context + Evidence + Adaptive Thresholds + Config) ---
export async function getCoupledFiles(
	filePath: string,
	configOrContext?: MemoriaConfig | null | AnalysisContext,
) {
	// Determine if we received a context or just config
	const ctx =
		configOrContext && "git" in configOrContext
			? (configOrContext as AnalysisContext)
			: null;
	const config = ctx ? ctx.config : (configOrContext as MemoriaConfig | null);

	// Include config in cache key if relevant settings are specified
	const configKey = getStableConfigKey(config);
	const cacheKey = `coupling:${filePath}:${configKey}`;
	if (cache.has(cacheKey)) return cache.get(cacheKey);

	try {
		// Use context if provided, otherwise initialize (backward compatibility)
		const git = ctx ? ctx.git : getGitForFile(filePath);
		const repoRoot = ctx
			? ctx.repoRoot
			: (await git.revparse(["--show-toplevel"])).trim();

		// Get project metrics and adaptive thresholds (with config overrides)
		const metrics = ctx ? ctx.metrics : await getProjectMetrics(repoRoot);
		const thresholds = getAdaptiveThresholds(metrics, config);

		// Load ignore filter (with config patterns)
		const ig = ctx ? ctx.ig : await getIgnoreFilter(repoRoot, config);

		// Use adaptive analysis window
		const log = await git.log({
			file: filePath,
			maxCount: thresholds.analysisWindow,
		});
		if (log.total === 0) return [];

		// Cold start filter: fewer than 3 commits means coupling data is statistically noise
		// (e.g., "coupled to .gitignore" on initial commit is true but useless)
		if (log.total < 3) return [];

		// Track both count AND the most recent commit info
		const couplingMap: Record<
			string,
			{ count: number; lastHash: string; lastMsg: string }
		> = {};

		// Get max files per commit threshold (default: 15)
		const maxFilesPerCommit = config?.thresholds?.maxFilesPerCommit ?? 15;

		// Process all commits to find co-changes (limited to 5 concurrent git operations)
		await mapConcurrent(log.all, 5, async (commit) => {
			const show = await git.show([commit.hash, "--name-only", "--format="]);
			const allFiles = show
				.split("\n")
				.map((f) => f.trim())
				.filter((f) => f);

			// Skip bulk commits (refactors, renames, large merges) - these create false coupling
			if (allFiles.length > maxFilesPerCommit) {
				return;
			}

			const files = allFiles.filter((f) => {
				if (f.includes(path.basename(filePath))) return false;
				return !shouldIgnoreFile(f, ig);
			});

			files.forEach((f) => {
				if (!couplingMap[f]) {
					// First time seeing this file - store the most recent commit
					couplingMap[f] = {
						count: 0,
						lastHash: commit.hash,
						lastMsg: commit.message,
					};
				}
				couplingMap[f].count++;
			});
		});

		// Get top 5 coupled files using adaptive threshold
		const topCoupled = Object.entries(couplingMap)
			.sort(([, a], [, b]) => b.count - a.count)
			.slice(0, 5)
			.map(([file, data]) => ({
				file,
				count: data.count,
				score: Math.round((data.count / log.total) * 100),
				lastHash: data.lastHash,
				reason: data.lastMsg,
			}))
			.filter((x) => x.score > thresholds.couplingThreshold);

		// Fetch diff evidence for all coupled files and parse into structured summaries
		const result = await Promise.all(
			topCoupled.map(async (item) => {
				const rawDiff = await getDiffSnippet(
					repoRoot,
					item.file,
					item.lastHash,
				);
				const evidence = parseDiffToSummary(rawDiff);
				return {
					file: item.file,
					score: item.score,
					reason: item.reason,
					lastHash: item.lastHash,
					evidence, // Now a structured DiffSummary instead of raw string
				};
			}),
		);

		cache.set(cacheKey, result);
		return result;
	} catch (_e) {
		return [];
	}
}

// --- ENGINE 2: DRIFT (Enhanced with Adaptive Thresholds + Config) ---
export async function checkDrift(
	sourceFile: string,
	coupledFiles: { file: string }[],
	configOrContext?: MemoriaConfig | null | AnalysisContext,
) {
	// Determine if we received a context or just config
	const ctx =
		configOrContext && "git" in configOrContext
			? (configOrContext as AnalysisContext)
			: null;
	const config = ctx ? ctx.config : (configOrContext as MemoriaConfig | null);

	const alerts = [];
	try {
		const sourceStats = await fs.stat(sourceFile);

		// Use context if provided, otherwise initialize (backward compatibility)
		const git = ctx ? ctx.git : getGitForFile(sourceFile);
		const repoRoot = ctx
			? ctx.repoRoot
			: (await git.revparse(["--show-toplevel"])).trim();

		// Get adaptive drift threshold (with config overrides)
		const metrics = ctx ? ctx.metrics : await getProjectMetrics(repoRoot);
		const thresholds = getAdaptiveThresholds(metrics, config);

		// Parallelize fs.stat calls for better performance
		const siblingStatResults = await Promise.all(
			coupledFiles.map(async ({ file }) => {
				try {
					const siblingPath = path.join(repoRoot, file);
					const stats = await fs.stat(siblingPath);
					return { file, stats, error: null };
				} catch (e) {
					return { file, stats: null, error: e };
				}
			}),
		);

		// Process results and build alerts
		for (const { file, stats } of siblingStatResults) {
			if (stats) {
				const diffMs = sourceStats.mtimeMs - stats.mtimeMs;
				const daysDiff = Math.floor(diffMs / (1000 * 60 * 60 * 24));

				// Use adaptive drift threshold instead of hardcoded 7 days
				if (daysDiff > thresholds.driftDays) {
					alerts.push({ file, daysOld: daysDiff });
				}
			}
			// Skip files that don't exist (deleted or moved)
		}
	} catch (_e) {
		/* Source new */
	}
	return alerts;
}

// --- ENGINE 3: STATIC IMPORTS (The Fallback Layer) ---
// Solves the "New File Problem" - files with no git history but many importers
export async function getImporters(
	filePath: string,
	ctx?: AnalysisContext,
): Promise<string[]> {
	const cacheKey = `importers:${filePath}`;
	if (cache.has(cacheKey)) return cache.get(cacheKey);

	try {
		// Use context if provided, otherwise initialize (backward compatibility)
		const git = ctx ? ctx.git : getGitForFile(filePath);
		const repoRoot = ctx
			? ctx.repoRoot
			: (await git.revparse(["--show-toplevel"])).trim();

		// Get the filename without extension for import matching
		const fileName = path.basename(filePath, path.extname(filePath));
		const relativePath = path.relative(repoRoot, filePath);

		// Load ignore filter
		const ig = ctx ? ctx.ig : await getIgnoreFilter(repoRoot);

		// Helper to detect test files
		const isTestFile = (f: string) => /\.(test|spec)\.[jt]sx?$/.test(f);
		const targetIsTestFile = isTestFile(filePath);

		// Use git grep to find files that actually import this file
		// Match import/require/from statements with the filename in quotes
		// This is more precise than just searching for the filename
		const importPattern = `(import|from|require).*['"].*${fileName}`;
		const grepResult = await git
			.raw(["grep", "-l", "-E", "--", importPattern])
			.catch(() => "");

		// Parse results and filter
		const importers = grepResult
			.split("\n")
			.map((line) => line.trim())
			.filter((f) => {
				if (!f) return false;
				// Exclude the file itself (check both relative path and basename)
				if (f === relativePath) return false;
				if (path.basename(f) === path.basename(filePath)) return false;
				// Exclude ignored files
				if (shouldIgnoreFile(f, ig)) return false;
				// Don't report test files as importers of other test files
				if (targetIsTestFile && isTestFile(f)) return false;
				return true;
			});

		// Deduplicate
		const result = [...new Set(importers)];
		cache.set(cacheKey, result);
		return result;
	} catch (_e) {
		return [];
	}
}

// --- ENGINE 4: DOCUMENTATION COUPLING (Git-Native) ---
// Finds markdown files that reference exported identifiers from the source file
// Solves the "README needs update when output changes" problem

/**
 * Extract exported identifiers from source code using regex (no AST needed)
 */
export function extractExports(sourceCode: string): string[] {
	const exportPattern =
		/export\s+(?:async\s+)?(?:function|const|let|var|class|interface|type|enum)\s+(\w+)/g;
	const identifiers: string[] = [];
	let match: RegExpExecArray | null;
	while ((match = exportPattern.exec(sourceCode)) !== null) {
		identifiers.push(match[1]);
	}
	// Also catch `export { name }` and `export default function name`
	const namedExportPattern = /export\s+\{\s*([^}]+)\s*\}/g;
	while ((match = namedExportPattern.exec(sourceCode)) !== null) {
		const names = match[1].split(",").map((n) => n.trim().split(/\s+as\s+/)[0]);
		identifiers.push(...names.filter((n) => n && !n.includes("*")));
	}
	const defaultFnPattern = /export\s+default\s+(?:async\s+)?function\s+(\w+)/g;
	while ((match = defaultFnPattern.exec(sourceCode)) !== null) {
		identifiers.push(match[1]);
	}
	// Filter out common/meaningless names and dedupe
	const meaningless = new Set(["default", "module", "exports", "index"]);
	return [...new Set(identifiers)].filter(
		(id) => id.length > 2 && !meaningless.has(id.toLowerCase()),
	);
}

/**
 * Find markdown files that mention exported identifiers from the source file
 */
export async function getDocsCoupling(
	filePath: string,
	ctx?: AnalysisContext,
): Promise<EnhancedCoupledFile[]> {
	const cacheKey = `docs-coupling:${filePath}`;
	if (cache.has(cacheKey)) return cache.get(cacheKey);

	try {
		const git = ctx ? ctx.git : getGitForFile(filePath);
		const repoRoot = ctx
			? ctx.repoRoot
			: (await git.revparse(["--show-toplevel"])).trim();
		const relativePath = path.relative(repoRoot, filePath);

		// Read source file and extract exports
		const sourceContent = await fs.readFile(filePath, "utf8").catch(() => "");
		const exports = extractExports(sourceContent);

		if (exports.length === 0) {
			cache.set(cacheKey, []);
			return [];
		}

		// Build grep pattern: search for any of the exported identifiers in markdown
		// Limit to top 10 exports to avoid overly long grep commands
		const topExports = exports.slice(0, 10);

		// Use git grep with multiple -e patterns (OR logic)
		const grepArgs = [
			"--no-optional-locks",
			"grep",
			"-l",
			"-i", // Case insensitive for docs
			...topExports.flatMap((id) => ["-e", id]),
			"--",
			"*.md",
			"**/*.md",
		];

		const grepResult = await git.raw(grepArgs).catch(() => "");
		const mdFiles = grepResult
			.split("\n")
			.map((f) => f.trim())
			.filter((f) => f && !f.includes(relativePath));

		if (mdFiles.length === 0) {
			cache.set(cacheKey, []);
			return [];
		}

		// For each markdown file, find which exports it mentions
		const results: EnhancedCoupledFile[] = [];

		await mapConcurrent(mdFiles.slice(0, 10), 5, async (mdFile) => {
			const mdPath = path.join(repoRoot, mdFile);
			const mdContent = await fs.readFile(mdPath, "utf8").catch(() => "");
			const matchedExports = topExports.filter((id) =>
				new RegExp(`\\b${id}\\b`, "i").test(mdContent),
			);

			if (matchedExports.length >= 1) {
				results.push({
					file: mdFile,
					score: Math.min(70, 40 + matchedExports.length * 10), // Base 40, +10 per match, max 70
					source: "docs",
					reason: `Mentions: ${matchedExports.slice(0, 3).join(", ")}${matchedExports.length > 3 ? ` (+${matchedExports.length - 3} more)` : ""}`,
				});
			}
		});

		// Sort by score descending
		results.sort((a, b) => b.score - a.score);
		cache.set(cacheKey, results.slice(0, 5));
		return results.slice(0, 5);
	} catch (_e) {
		return [];
	}
}

// --- ENGINE 5: TYPE/SEMANTIC COUPLING (Git Pickaxe) ---
// Finds files where the same type/interface/enum was added or modified
// Uses git log -S for "pickaxe" search

/**
 * Extract type definitions (interface, type, enum) from source code
 */
export function extractTypeDefinitions(sourceCode: string): string[] {
	const typePattern =
		/(?:export\s+)?(?:interface|type|enum)\s+(\w+)/g;
	const types: string[] = [];
	let match: RegExpExecArray | null;
	while ((match = typePattern.exec(sourceCode)) !== null) {
		types.push(match[1]);
	}
	// Filter out common/generic names
	const generic = new Set(["Props", "State", "Options", "Config", "Data", "Result", "Response", "Request"]);
	return [...new Set(types)].filter(
		(t) => t.length > 2 && !generic.has(t),
	);
}

/**
 * Find files that share type definitions using git grep
 */
export async function getTypeCoupling(
	filePath: string,
	ctx?: AnalysisContext,
): Promise<EnhancedCoupledFile[]> {
	const cacheKey = `type-coupling:${filePath}`;
	if (cache.has(cacheKey)) return cache.get(cacheKey);

	try {
		const git = ctx ? ctx.git : getGitForFile(filePath);
		const repoRoot = ctx
			? ctx.repoRoot
			: (await git.revparse(["--show-toplevel"])).trim();
		const relativePath = path.relative(repoRoot, filePath);

		// Read source and extract type names
		const sourceContent = await fs.readFile(filePath, "utf8").catch(() => "");
		const types = extractTypeDefinitions(sourceContent);

		if (types.length === 0) {
			cache.set(cacheKey, []);
			return [];
		}

		// Build a map of files -> types they reference
		const fileTypeMap: Map<string, string[]> = new Map();
		const topTypes = types.slice(0, 5); // Limit to 5 types for performance

		// Search for each type using git grep
		await mapConcurrent(topTypes, 3, async (typeName) => {
			// Match type usage patterns: import, extends, implements, type annotation
			const grepResult = await git
				.raw([
					"--no-optional-locks",
					"grep",
					"-l",
					"-E",
					`(import.*${typeName}|:\\s*${typeName}[^a-zA-Z]|<${typeName}>|extends\\s+${typeName}|implements\\s+${typeName})`,
					"--",
					"*.ts",
					"*.tsx",
					"*.js",
					"*.jsx",
				])
				.catch(() => "");

			const files = grepResult
				.split("\n")
				.map((f) => f.trim())
				.filter((f) => f && f !== relativePath);

			for (const file of files) {
				if (!fileTypeMap.has(file)) {
					fileTypeMap.set(file, []);
				}
				fileTypeMap.get(file)!.push(typeName);
			}
		});

		// Convert to results
		const results: EnhancedCoupledFile[] = [];
		for (const [file, sharedTypes] of fileTypeMap) {
			results.push({
				file,
				score: Math.min(65, 35 + sharedTypes.length * 15), // Base 35, +15 per type, max 65
				source: "type",
				reason: `Shares types: ${sharedTypes.join(", ")}`,
			});
		}

		// Sort and limit
		results.sort((a, b) => b.score - a.score);
		cache.set(cacheKey, results.slice(0, 5));
		return results.slice(0, 5);
	} catch (_e) {
		return [];
	}
}

// --- ENGINE 6: CONTENT/STRING COUPLING (Git Grep -F) ---
// Finds files sharing significant string literals (error messages, API endpoints)

/**
 * Extract significant string literals from source code
 */
export function extractStringLiterals(sourceCode: string): string[] {
	// Match strings in quotes (single, double, or backtick)
	const stringPattern = /['"`]([^'"`\n]{15,80})['"`]/g;
	const strings: string[] = [];
	let match: RegExpExecArray | null;
	while ((match = stringPattern.exec(sourceCode)) !== null) {
		strings.push(match[1]);
	}

	// Filter to significant strings (error messages, endpoints, format strings)
	const significant = strings.filter((s) => {
		// Skip common patterns
		if (/^https?:\/\/localhost/.test(s)) return false;
		if (/^\s*$/.test(s)) return false;
		if (/^[a-z-]+$/.test(s)) return false; // CSS classes, kebab-case
		if (/^\d+$/.test(s)) return false;
		if (/^\.?\/?[\w-]+$/.test(s)) return false; // Simple paths
		// Keep error messages, format strings, endpoints
		if (/error|failed|invalid|not found|unauthorized/i.test(s)) return true;
		if (/^\/api\//.test(s)) return true;
		if (/\$\{|\%[sdf]/.test(s)) return true; // Template/format strings
		// Keep longer descriptive strings
		if (s.length > 30 && /\s/.test(s)) return true;
		return false;
	});

	return [...new Set(significant)].slice(0, 5); // Limit to 5 strings
}

/**
 * Find files sharing significant string literals
 */
export async function getContentCoupling(
	filePath: string,
	ctx?: AnalysisContext,
): Promise<EnhancedCoupledFile[]> {
	const cacheKey = `content-coupling:${filePath}`;
	if (cache.has(cacheKey)) return cache.get(cacheKey);

	try {
		const git = ctx ? ctx.git : getGitForFile(filePath);
		const repoRoot = ctx
			? ctx.repoRoot
			: (await git.revparse(["--show-toplevel"])).trim();
		const relativePath = path.relative(repoRoot, filePath);

		// Read source and extract strings
		const sourceContent = await fs.readFile(filePath, "utf8").catch(() => "");
		const strings = extractStringLiterals(sourceContent);

		if (strings.length === 0) {
			cache.set(cacheKey, []);
			return [];
		}

		// Build a map of files -> shared strings
		const fileStringMap: Map<string, string[]> = new Map();

		// Search for each string using git grep -F (fixed string)
		await mapConcurrent(strings, 3, async (str) => {
			// Escape for grep and truncate
			const searchStr = str.slice(0, 50);
			const grepResult = await git
				.raw([
					"--no-optional-locks",
					"grep",
					"-l",
					"-F",
					searchStr,
					"--",
					"*.ts",
					"*.tsx",
					"*.js",
					"*.jsx",
				])
				.catch(() => "");

			const files = grepResult
				.split("\n")
				.map((f) => f.trim())
				.filter((f) => f && f !== relativePath);

			for (const file of files) {
				if (!fileStringMap.has(file)) {
					fileStringMap.set(file, []);
				}
				fileStringMap.get(file)!.push(searchStr.slice(0, 30) + (str.length > 30 ? "..." : ""));
			}
		});

		// Convert to results
		const results: EnhancedCoupledFile[] = [];
		for (const [file, sharedStrings] of fileStringMap) {
			// Classify the coupling type
			const hasError = sharedStrings.some((s) => /error|fail|invalid/i.test(s));
			const hasEndpoint = sharedStrings.some((s) => /^\/api\//.test(s));
			const matchType = hasError ? "error" : hasEndpoint ? "endpoint" : "content";

			results.push({
				file,
				score: Math.min(50, 25 + sharedStrings.length * 10), // Base 25, +10 per string, max 50
				source: "content",
				reason: `Shared ${matchType}: "${sharedStrings[0]}"${sharedStrings.length > 1 ? ` (+${sharedStrings.length - 1})` : ""}`,
			});
		}

		// Sort and limit
		results.sort((a, b) => b.score - a.score);
		cache.set(cacheKey, results.slice(0, 5));
		return results.slice(0, 5);
	} catch (_e) {
		return [];
	}
}

// --- ENGINE 9: TEST FILE COUPLING (Auto-Discovery) ---
// Finds test files that should be updated when source changes

/**
 * Find test files for a given source file based on naming conventions
 * Works across any language - no hardcoded extensions
 */
export async function getTestCoupling(
	filePath: string,
	ctx?: AnalysisContext,
): Promise<EnhancedCoupledFile[]> {
	const cacheKey = `test-coupling:${filePath}`;
	if (cache.has(cacheKey)) return cache.get(cacheKey);

	try {
		const git = ctx ? ctx.git : getGitForFile(filePath);
		const repoRoot = ctx
			? ctx.repoRoot
			: (await git.revparse(["--show-toplevel"])).trim();
		const relativePath = path.relative(repoRoot, filePath);

		// Get basename without extension (login.ts -> login)
		const ext = path.extname(filePath);
		const basename = path.basename(filePath, ext);

		// Skip if this is already a test file
		if (/\.(test|spec)\.|\.(test|spec)$|_test\.|test_/i.test(path.basename(filePath))) {
			cache.set(cacheKey, []);
			return [];
		}

		// Build test file naming patterns (language-agnostic)
		// Escape special regex chars in basename
		const escapedBasename = basename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const testPatterns = [
			`${escapedBasename}\\.test\\.`,      // login.test.ts, login.test.js
			`${escapedBasename}\\.spec\\.`,      // login.spec.ts, login.spec.py
			`${escapedBasename}_test\\.`,        // login_test.go, login_test.py
			`test_${escapedBasename}\\.`,        // test_login.py
			`${escapedBasename}-test\\.`,        // login-test.js
			`${escapedBasename}-spec\\.`,        // login-spec.js
		];

		// Search using git grep for files matching test naming pattern
		const grepResult = await git
			.raw([
				"--no-optional-locks",
				"grep",
				"-l",
				"-E",
				testPatterns.join("|"),
				"--",
				"*",
			])
			.catch(() => "");

		const testFiles = grepResult
			.split("\n")
			.map((f) => f.trim())
			.filter((f) => f && f !== relativePath);

		const results: EnhancedCoupledFile[] = [];

		// Add test files with high coupling score
		for (const testFile of testFiles.slice(0, 5)) {
			results.push({
				file: testFile,
				score: 85, // High score - tests should always be updated
				source: "test",
				reason: `Test file for ${basename}. Update when changing exports.`,
			});
		}

		// Also look for mock/fixture files by searching for the class/function names
		const sourceContent = await fs.readFile(filePath, "utf8").catch(() => "");
		const exports = extractExports(sourceContent);

		if (exports.length > 0) {
			const topExports = exports.slice(0, 5);
			const mockPattern = topExports
				.map((e) => `mock.*${e}|${e}.*[Mm]ock|fake.*${e}|${e}.*[Ff]ake|stub.*${e}`)
				.join("|");

			const mockResult = await git
				.raw([
					"--no-optional-locks",
					"grep",
					"-l",
					"-i",
					"-E",
					mockPattern,
				])
				.catch(() => "");

			const mockFiles = mockResult
				.split("\n")
				.map((f) => f.trim())
				.filter((f) => f && f !== relativePath && !results.some((r) => r.file === f));

			for (const mockFile of mockFiles.slice(0, 3)) {
				results.push({
					file: mockFile,
					score: 70,
					source: "test",
					reason: `Mock/fixture file. Update if interface changes.`,
				});
			}
		}

		cache.set(cacheKey, results.slice(0, 5));
		return results.slice(0, 5);
	} catch (_e) {
		return [];
	}
}

// --- ENGINE 10: ENVIRONMENT VARIABLE COUPLING (Auto-Discovery) ---
// Finds files sharing the same environment variables

/**
 * Extract environment variable names from source code
 * Uses universal ALL_CAPS_UNDERSCORE pattern
 */
export function extractEnvVars(sourceCode: string): string[] {
	// Match ALL_CAPS_UNDERSCORE pattern (common env var convention)
	const envVarRegex = /\b([A-Z][A-Z0-9_]{3,})\b/g;
	const matches: string[] = [];
	let match: RegExpExecArray | null;

	while ((match = envVarRegex.exec(sourceCode)) !== null) {
		matches.push(match[1]);
	}

	// Filter to likely env vars
	const filtered = matches.filter((v) => {
		// Must contain underscore (API_KEY, DATABASE_URL)
		if (!v.includes("_")) return false;
		// Skip common non-env constants
		const skipPatterns = [
			"HTTP_", "HTML_", "CSS_", "JSON_", "XML_", "UTF_",
			"CONTENT_TYPE", "STATUS_",
		];
		if (skipPatterns.some((p) => v.startsWith(p))) return false;
		// Keep common env prefixes
		const keepPrefixes = [
			"API_", "DATABASE_", "DB_", "STRIPE_", "AUTH_", "JWT_",
			"AWS_", "GOOGLE_", "GITHUB_", "REDIS_", "MONGO_",
			"POSTGRES_", "MYSQL_", "SECRET_", "PRIVATE_", "PUBLIC_",
			"NEXT_", "VITE_", "REACT_APP_", "VUE_APP_",
		];
		if (keepPrefixes.some((p) => v.startsWith(p))) return true;
		// Keep if ends with common env suffixes
		const keepSuffixes = ["_KEY", "_SECRET", "_TOKEN", "_URL", "_URI", "_HOST", "_PORT", "_PASSWORD"];
		if (keepSuffixes.some((s) => v.endsWith(s))) return true;
		return false;
	});

	return [...new Set(filtered)].slice(0, 10);
}

/**
 * Find files sharing environment variables
 */
export async function getEnvCoupling(
	filePath: string,
	ctx?: AnalysisContext,
): Promise<EnhancedCoupledFile[]> {
	const cacheKey = `env-coupling:${filePath}`;
	if (cache.has(cacheKey)) return cache.get(cacheKey);

	try {
		const git = ctx ? ctx.git : getGitForFile(filePath);
		const repoRoot = ctx
			? ctx.repoRoot
			: (await git.revparse(["--show-toplevel"])).trim();
		const relativePath = path.relative(repoRoot, filePath);

		const sourceContent = await fs.readFile(filePath, "utf8").catch(() => "");
		const envVars = extractEnvVars(sourceContent);

		if (envVars.length === 0) {
			cache.set(cacheKey, []);
			return [];
		}

		// Build regex pattern for env vars
		const envPattern = envVars.join("|");

		// Search all tracked files for these env vars
		const grepResult = await git
			.raw([
				"--no-optional-locks",
				"grep",
				"-l",
				"-E",
				envPattern,
			])
			.catch(() => "");

		const files = grepResult
			.split("\n")
			.map((f) => f.trim())
			.filter((f) => f && f !== relativePath);

		// For each file, find which env vars it shares
		const fileEnvMap: Map<string, string[]> = new Map();

		await mapConcurrent(files.slice(0, 20), 5, async (file) => {
			const filePath = path.join(repoRoot, file);
			const content = await fs.readFile(filePath, "utf8").catch(() => "");
			const sharedVars = envVars.filter((v) => content.includes(v));
			if (sharedVars.length > 0) {
				fileEnvMap.set(file, sharedVars);
			}
		});

		const results: EnhancedCoupledFile[] = [];
		for (const [file, sharedVars] of fileEnvMap) {
			results.push({
				file,
				score: Math.min(75, 40 + sharedVars.length * 10),
				source: "env",
				reason: `Shares env vars: ${sharedVars.slice(0, 3).join(", ")}${sharedVars.length > 3 ? ` (+${sharedVars.length - 3})` : ""}`,
			});
		}

		results.sort((a, b) => b.score - a.score);
		cache.set(cacheKey, results.slice(0, 5));
		return results.slice(0, 5);
	} catch (_e) {
		return [];
	}
}

// --- ENGINE 11: SCHEMA/MODEL COUPLING (Auto-Discovery) ---
// Finds files affected by database schema or model changes

/**
 * Extract table/model names from schema-related source code
 */
export function extractSchemaNames(sourceCode: string): string[] {
	const names: string[] = [];

	// SQL: CREATE TABLE users, ALTER TABLE orders
	const sqlPattern = /(?:CREATE|ALTER|DROP)\s+TABLE\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?["`]?(\w+)["`]?/gi;
	let match: RegExpExecArray | null;
	while ((match = sqlPattern.exec(sourceCode)) !== null) {
		names.push(match[1]);
	}

	// ORM Models: class User extends Model, class OrderModel
	const classPattern = /class\s+(\w+)(?:Model)?\s+(?:extends|implements)/gi;
	while ((match = classPattern.exec(sourceCode)) !== null) {
		const name = match[1].replace(/Model$/, "");
		if (name.length > 2) names.push(name);
	}

	// Prisma: model User {
	const prismaPattern = /model\s+(\w+)\s*\{/gi;
	while ((match = prismaPattern.exec(sourceCode)) !== null) {
		names.push(match[1]);
	}

	// TypeORM/Hibernate decorators: @Entity("users")
	const decoratorPattern = /@(?:Entity|Table)\s*\(\s*["'](\w+)["']/gi;
	while ((match = decoratorPattern.exec(sourceCode)) !== null) {
		names.push(match[1]);
	}

	// Mongoose: new Schema({ ... }), mongoose.model("User"
	const mongoosePattern = /mongoose\.model\s*\(\s*["'](\w+)["']/gi;
	while ((match = mongoosePattern.exec(sourceCode)) !== null) {
		names.push(match[1]);
	}

	// Filter and dedupe
	const filtered = names.filter((n) => {
		// Skip common/generic names
		const generic = ["id", "data", "item", "entity", "model", "base", "abstract"];
		return n.length > 2 && !generic.includes(n.toLowerCase());
	});

	return [...new Set(filtered)].slice(0, 10);
}

/**
 * Detect if a file contains schema-related content
 */
export function isSchemaFile(sourceCode: string): boolean {
	const schemaIndicators = [
		/CREATE\s+TABLE/i,
		/ALTER\s+TABLE/i,
		/@Entity|@Table|@Column/,
		/model\s+\w+\s*\{/,
		/mongoose\.Schema/,
		/db\.Column|db\.relationship/i,
		/sequelize\.define/i,
	];
	return schemaIndicators.some((p) => p.test(sourceCode));
}

/**
 * Find files sharing schema/model references
 */
export async function getSchemaCoupling(
	filePath: string,
	ctx?: AnalysisContext,
): Promise<EnhancedCoupledFile[]> {
	const cacheKey = `schema-coupling:${filePath}`;
	if (cache.has(cacheKey)) return cache.get(cacheKey);

	try {
		const git = ctx ? ctx.git : getGitForFile(filePath);
		const repoRoot = ctx
			? ctx.repoRoot
			: (await git.revparse(["--show-toplevel"])).trim();
		const relativePath = path.relative(repoRoot, filePath);

		const sourceContent = await fs.readFile(filePath, "utf8").catch(() => "");

		// Only analyze if file has schema-related content
		if (!isSchemaFile(sourceContent)) {
			cache.set(cacheKey, []);
			return [];
		}

		const schemaNames = extractSchemaNames(sourceContent);

		if (schemaNames.length === 0) {
			cache.set(cacheKey, []);
			return [];
		}

		// Build search pattern for table/model references
		const patterns = schemaNames.flatMap((name) => [
			`\\b${name}\\b`,
			`["'\`]${name.toLowerCase()}["'\`]`,
			`["'\`]${name}["'\`]`,
		]);
		const searchPattern = patterns.join("|");

		const grepResult = await git
			.raw([
				"--no-optional-locks",
				"grep",
				"-l",
				"-E",
				searchPattern,
			])
			.catch(() => "");

		const files = grepResult
			.split("\n")
			.map((f) => f.trim())
			.filter((f) => f && f !== relativePath);

		// For each file, determine what schema names it references
		const fileSchemaMap: Map<string, string[]> = new Map();

		await mapConcurrent(files.slice(0, 20), 5, async (file) => {
			const filePath = path.join(repoRoot, file);
			const content = await fs.readFile(filePath, "utf8").catch(() => "");
			const sharedNames = schemaNames.filter(
				(n) => new RegExp(`\\b${n}\\b`, "i").test(content),
			);
			if (sharedNames.length > 0) {
				fileSchemaMap.set(file, sharedNames);
			}
		});

		const results: EnhancedCoupledFile[] = [];
		for (const [file, sharedNames] of fileSchemaMap) {
			// Detect if it's a migration file
			const isMigration = /migration|migrate/i.test(file);
			const isQuery = /repo|repository|query|dao/i.test(file);

			results.push({
				file,
				score: Math.min(80, 45 + sharedNames.length * 12),
				source: "schema",
				reason: isMigration
					? `Migration for: ${sharedNames.join(", ")}. Check ordering.`
					: isQuery
						? `Queries: ${sharedNames.join(", ")}. Schema changes may break.`
						: `References: ${sharedNames.join(", ")}`,
			});
		}

		results.sort((a, b) => b.score - a.score);
		cache.set(cacheKey, results.slice(0, 5));
		return results.slice(0, 5);
	} catch (_e) {
		return [];
	}
}

// --- ENGINE 12: API ENDPOINT COUPLING (Auto-Discovery) ---
// Finds client code that calls API endpoints defined in the target file

/**
 * Extract API endpoint paths from source code
 */
export function extractApiEndpoints(sourceCode: string): string[] {
	const endpoints: string[] = [];

	// Match endpoint strings: "/api/users", "/v1/auth"
	const endpointPattern = /["'`](\/(?:api|v\d+)\/[^"'`\s]+)["'`]/g;
	let match: RegExpExecArray | null;
	while ((match = endpointPattern.exec(sourceCode)) !== null) {
		// Clean up dynamic segments: /api/users/:id -> /api/users/
		const clean = match[1].replace(/:\w+/g, "").replace(/\/+$/, "");
		if (clean.length > 4) endpoints.push(clean);
	}

	// Also match route definitions: app.get("/users", ...), router.post("/auth"
	const routePattern = /\.(get|post|put|delete|patch)\s*\(\s*["'`](\/[^"'`]+)["'`]/gi;
	while ((match = routePattern.exec(sourceCode)) !== null) {
		const clean = match[2].replace(/:\w+/g, "").replace(/\/+$/, "");
		if (clean.length > 1) endpoints.push(clean);
	}

	// Decorator routes: @Get("/users"), @Post("/auth")
	const decoratorPattern = /@(?:Get|Post|Put|Delete|Patch)\s*\(\s*["'`](\/[^"'`]*)["'`]/gi;
	while ((match = decoratorPattern.exec(sourceCode)) !== null) {
		const clean = match[1].replace(/:\w+/g, "").replace(/\/+$/, "");
		if (clean.length > 0) endpoints.push(clean || "/");
	}

	return [...new Set(endpoints)].slice(0, 10);
}

/**
 * Detect if a file defines API routes
 */
export function isApiDefinitionFile(sourceCode: string): boolean {
	const apiIndicators = [
		/\.(get|post|put|delete|patch)\s*\(/i,
		/@(Get|Post|Put|Delete|Patch)\s*\(/,
		/router\.(get|post|put|delete)/i,
		/app\.(get|post|put|delete)/i,
		/createRouter|useRouter/,
		/export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)\b/, // Next.js API routes
	];
	return apiIndicators.some((p) => p.test(sourceCode));
}

/**
 * Find files that consume API endpoints
 */
export async function getApiCoupling(
	filePath: string,
	ctx?: AnalysisContext,
): Promise<EnhancedCoupledFile[]> {
	const cacheKey = `api-coupling:${filePath}`;
	if (cache.has(cacheKey)) return cache.get(cacheKey);

	try {
		const git = ctx ? ctx.git : getGitForFile(filePath);
		const repoRoot = ctx
			? ctx.repoRoot
			: (await git.revparse(["--show-toplevel"])).trim();
		const relativePath = path.relative(repoRoot, filePath);

		const sourceContent = await fs.readFile(filePath, "utf8").catch(() => "");

		// Only analyze if file defines API routes
		if (!isApiDefinitionFile(sourceContent)) {
			cache.set(cacheKey, []);
			return [];
		}

		const endpoints = extractApiEndpoints(sourceContent);

		if (endpoints.length === 0) {
			cache.set(cacheKey, []);
			return [];
		}

		// Search for files that call these endpoints
		const allConsumers: Map<string, string[]> = new Map();

		await mapConcurrent(endpoints.slice(0, 5), 3, async (endpoint) => {
			// Use fixed string search for exact endpoint matches
			const grepResult = await git
				.raw([
					"--no-optional-locks",
					"grep",
					"-l",
					"-F",
					endpoint,
				])
				.catch(() => "");

			const files = grepResult
				.split("\n")
				.map((f) => f.trim())
				.filter((f) => f && f !== relativePath);

			for (const file of files) {
				if (!allConsumers.has(file)) {
					allConsumers.set(file, []);
				}
				allConsumers.get(file)!.push(endpoint);
			}
		});

		const results: EnhancedCoupledFile[] = [];
		for (const [file, endpoints] of allConsumers) {
			// Skip the source file itself and other route definition files
			const fileContent = await fs.readFile(path.join(repoRoot, file), "utf8").catch(() => "");
			if (isApiDefinitionFile(fileContent)) continue;

			results.push({
				file,
				score: Math.min(85, 50 + endpoints.length * 12),
				source: "api",
				reason: `Calls: ${endpoints.slice(0, 2).join(", ")}${endpoints.length > 2 ? ` (+${endpoints.length - 2})` : ""}. Response changes will break this.`,
			});
		}

		results.sort((a, b) => b.score - a.score);
		cache.set(cacheKey, results.slice(0, 5));
		return results.slice(0, 5);
	} catch (_e) {
		return [];
	}
}

// --- ENGINE 13: RE-EXPORT CHAIN COUPLING (Transitive) ---
// Finds files affected through barrel/index re-exports

/**
 * Find files that re-export the target file
 */
export async function getTransitiveCoupling(
	filePath: string,
	ctx?: AnalysisContext,
): Promise<EnhancedCoupledFile[]> {
	const cacheKey = `transitive-coupling:${filePath}`;
	if (cache.has(cacheKey)) return cache.get(cacheKey);

	try {
		const git = ctx ? ctx.git : getGitForFile(filePath);
		const repoRoot = ctx
			? ctx.repoRoot
			: (await git.revparse(["--show-toplevel"])).trim();
		const relativePath = path.relative(repoRoot, filePath);

		// Get filename without extension
		const ext = path.extname(filePath);
		const basename = path.basename(filePath, ext);
		const escapedBasename = basename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

		// Find files that re-export this file
		// Pattern: export * from './UserService' or export { x } from './UserService'
		const reExportPattern = `export.*from.*['"].*${escapedBasename}['"]`;

		const grepResult = await git
			.raw([
				"--no-optional-locks",
				"grep",
				"-l",
				"-E",
				reExportPattern,
			])
			.catch(() => "");

		const barrels = grepResult
			.split("\n")
			.map((f) => f.trim())
			.filter((f) => f && f !== relativePath);

		if (barrels.length === 0) {
			cache.set(cacheKey, []);
			return [];
		}

		const results: EnhancedCoupledFile[] = [];

		// Add barrel files as direct coupling
		for (const barrel of barrels.slice(0, 3)) {
			results.push({
				file: barrel,
				score: 60,
				source: "transitive",
				reason: `Re-exports this file. Changes propagate through this barrel.`,
			});
		}

		// Find transitive importers (files that import from the barrels)
		const transitiveImporters: Map<string, string> = new Map();

		await mapConcurrent(barrels.slice(0, 3), 3, async (barrel) => {
			const barrelBasename = path.basename(barrel, path.extname(barrel));
			const barrelDir = path.dirname(barrel);

			// Search for imports from this barrel
			const importPattern = `from.*['"].*${barrelDir === "." ? "" : barrelDir + "/"}${barrelBasename}['"]|from.*['"].*${barrelDir}['"]`;

			const importResult = await git
				.raw([
					"--no-optional-locks",
					"grep",
					"-l",
					"-E",
					importPattern,
				])
				.catch(() => "");

			const importers = importResult
				.split("\n")
				.map((f) => f.trim())
				.filter((f) => f && f !== relativePath && f !== barrel);

			for (const importer of importers) {
				if (!transitiveImporters.has(importer)) {
					transitiveImporters.set(importer, barrel);
				}
			}
		});

		// Add transitive importers
		for (const [importer, viaBarrel] of transitiveImporters) {
			results.push({
				file: importer,
				score: 55,
				source: "transitive",
				reason: `Imports via ${path.basename(viaBarrel)}. Indirect dependency.`,
			});
		}

		results.sort((a, b) => b.score - a.score);
		cache.set(cacheKey, results.slice(0, 5));
		return results.slice(0, 5);
	} catch (_e) {
		return [];
	}
}

// --- MERGE COUPLING RESULTS ---
// Combines results from all coupling engines into a unified list

export function mergeCouplingResults(
	gitCoupled: any[],
	docsCoupled: EnhancedCoupledFile[],
	typeCoupled: EnhancedCoupledFile[],
	contentCoupled: EnhancedCoupledFile[],
	testCoupled: EnhancedCoupledFile[] = [],
	envCoupled: EnhancedCoupledFile[] = [],
	schemaCoupled: EnhancedCoupledFile[] = [],
	apiCoupled: EnhancedCoupledFile[] = [],
	transitiveCoupled: EnhancedCoupledFile[] = [],
): EnhancedCoupledFile[] {
	const merged: EnhancedCoupledFile[] = [];
	const seenFiles = new Set<string>();

	// Add git coupling (highest priority, existing format with source tag)
	for (const c of gitCoupled) {
		if (!seenFiles.has(c.file)) {
			seenFiles.add(c.file);
			merged.push({
				file: c.file,
				score: c.score,
				source: "git",
				reason: c.reason,
				evidence: c.evidence,
				lastHash: c.lastHash,
			});
		}
	}

	// Add test coupling (high priority - tests should be updated)
	for (const c of testCoupled) {
		if (!seenFiles.has(c.file)) {
			seenFiles.add(c.file);
			merged.push(c);
		}
	}

	// Add API coupling (response changes break consumers)
	for (const c of apiCoupled) {
		if (!seenFiles.has(c.file)) {
			seenFiles.add(c.file);
			merged.push(c);
		}
	}

	// Add schema coupling (data integrity critical)
	for (const c of schemaCoupled) {
		if (!seenFiles.has(c.file)) {
			seenFiles.add(c.file);
			merged.push(c);
		}
	}

	// Add env coupling (runtime errors if mismatched)
	for (const c of envCoupled) {
		if (!seenFiles.has(c.file)) {
			seenFiles.add(c.file);
			merged.push(c);
		}
	}

	// Add docs coupling
	for (const c of docsCoupled) {
		if (!seenFiles.has(c.file)) {
			seenFiles.add(c.file);
			merged.push(c);
		}
	}

	// Add type coupling
	for (const c of typeCoupled) {
		if (!seenFiles.has(c.file)) {
			seenFiles.add(c.file);
			merged.push(c);
		}
	}

	// Add transitive coupling (barrel re-exports)
	for (const c of transitiveCoupled) {
		if (!seenFiles.has(c.file)) {
			seenFiles.add(c.file);
			merged.push(c);
		}
	}

	// Add content coupling (lowest priority)
	for (const c of contentCoupled) {
		if (!seenFiles.has(c.file)) {
			seenFiles.add(c.file);
			merged.push(c);
		}
	}

	// Sort by score descending and return top 15 (expanded from 10)
	return merged.sort((a, b) => b.score - a.score).slice(0, 15);
}

// --- ENGINE 7: SIBLING GUIDANCE (Smart New File Guidance) ---
// Provides intelligent guidance for new files based on sibling file patterns

export interface SiblingPattern {
	description: string;
	examples: string[];
	confidence: number; // 0-100
}

export interface SiblingGuidance {
	directory: string;
	siblingCount: number;
	patterns: SiblingPattern[];
	averageVolatility: number;
	hasTests: boolean;
	commonImports: string[];
}

export async function getSiblingGuidance(
	filePath: string,
	config?: MemoriaConfig | null,
): Promise<SiblingGuidance | null> {
	// Include config in cache key if custom keywords are specified (affects volatility calc)
	const configKey = getStableConfigKey(config);
	const cacheKey = `siblings:${filePath}:${configKey}`;
	if (cache.has(cacheKey)) return cache.get(cacheKey);

	try {
		const dir = path.dirname(filePath);
		const ext = path.extname(filePath);
		const fileName = path.basename(filePath, ext);

		// Read directory contents
		const dirContents = await fs.readdir(dir);

		// Find siblings with same extension (excluding the target file)
		const siblings = dirContents.filter((f) => {
			if (path.extname(f) !== ext) return false;
			if (path.basename(f, ext) === fileName) return false;
			return true;
		});

		// If no siblings, not much guidance to give
		if (siblings.length === 0) {
			cache.set(cacheKey, null);
			return null;
		}

		const patterns: SiblingPattern[] = [];
		let totalPanicScore = 0;
		let volatilityCount = 0;
		const importCounts: Record<string, number> = {};

		// Check for test files using pre-compiled regex
		const siblingBases = siblings.map((s) => path.basename(s, ext));
		const hasTestFiles = siblingBases.some((base) =>
			TEST_SUFFIX_REGEX.test(base),
		);

		// Check if this file should have a test
		const isNotTestFile = !TEST_SUFFIX_REGEX.test(fileName);
		if (hasTestFiles && isNotTestFile) {
			const testExamples = siblingBases
				.filter((base) => TEST_SUFFIX_REGEX.test(base))
				.slice(0, 3);
			patterns.push({
				description:
					"Test file expected - all siblings have matching test files",
				examples: testExamples.map((e) => e + ext),
				confidence: Math.min(
					100,
					(testExamples.length / siblings.length) * 100 + 30,
				),
			});
		}

		// Analyze sibling files for common patterns
		const siblingPaths = siblings.map((s) => path.join(dir, s));

		await Promise.all(
			siblingPaths.slice(0, 5).map(async (siblingPath) => {
				try {
					// Get volatility for each sibling
					const vol = await getVolatility(siblingPath, config);
					if (vol.commitCount > 0) {
						totalPanicScore += vol.panicScore;
						volatilityCount++;
					}

					// Read first 30 lines to detect common imports
					const content = await fs.readFile(siblingPath, "utf8");
					const lines = content.split("\n").slice(0, 30);

					// Extract imports/requires
					for (const line of lines) {
						// Match: import ... from '...', require('...'), from ... import
						const importMatch = line.match(
							/(?:import|require|from)\s*[([]?\s*['"]([^'"]+)['"]/,
						);
						if (importMatch) {
							const importPath = importMatch[1];
							importCounts[importPath] = (importCounts[importPath] || 0) + 1;
						}
					}
				} catch {
					// File might not be readable
				}
			}),
		);

		// Find common imports (used by >50% of siblings)
		const threshold = Math.max(2, Math.ceil(siblings.length * 0.5));
		const commonImports = Object.entries(importCounts)
			.filter(([, count]) => count >= threshold)
			.sort(([, a], [, b]) => b - a)
			.slice(0, 5)
			.map(([imp]) => imp);

		if (commonImports.length > 0) {
			patterns.push({
				description: `Common imports detected - ${commonImports.length} imports shared by siblings`,
				examples: commonImports,
				confidence: Math.min(100, (commonImports.length / 5) * 100),
			});
		}

		// Detect naming conventions from siblings
		const prefixes: Record<string, number> = {};
		const suffixes: Record<string, number> = {};
		for (const base of siblingBases) {
			// Check for common prefixes (e.g., "use", "get", "create")
			const prefixMatch = base.match(/^([a-z]+)[A-Z]/);
			if (prefixMatch) {
				prefixes[prefixMatch[1]] = (prefixes[prefixMatch[1]] || 0) + 1;
			}
			// Check for common suffixes (e.g., "Service", "Controller", "Hook")
			const suffixMatch = base.match(/([A-Z][a-z]+)$/);
			if (suffixMatch) {
				suffixes[suffixMatch[1]] = (suffixes[suffixMatch[1]] || 0) + 1;
			}
		}

		// Report dominant naming patterns
		const dominantPrefix = Object.entries(prefixes).find(
			([, count]) => count >= 2,
		);
		const dominantSuffix = Object.entries(suffixes).find(
			([, count]) => count >= 2,
		);

		if (dominantPrefix || dominantSuffix) {
			const namingParts: string[] = [];
			if (dominantPrefix) namingParts.push(`prefix "${dominantPrefix[0]}"`);
			if (dominantSuffix) namingParts.push(`suffix "${dominantSuffix[0]}"`);
			patterns.push({
				description: `Naming convention detected - siblings use ${namingParts.join(" and ")}`,
				examples: siblingBases.slice(0, 3).map((b) => b + ext),
				confidence: 70,
			});
		}

		const guidance: SiblingGuidance = {
			directory: path.basename(dir),
			siblingCount: siblings.length,
			patterns,
			averageVolatility:
				volatilityCount > 0 ? Math.round(totalPanicScore / volatilityCount) : 0,
			hasTests: hasTestFiles,
			commonImports,
		};

		cache.set(cacheKey, guidance);
		return guidance;
	} catch (_e) {
		cache.set(cacheKey, null);
		return null;
	}
}

// Format sibling guidance for AI consumption
export function formatSiblingGuidance(guidance: SiblingGuidance): string {
	let output = `### Sibling Patterns\n\n`;
	output += `Analyzed ${guidance.siblingCount} similar files in \`${guidance.directory}/\`\n\n`;

	for (const pattern of guidance.patterns) {
		output += `- ${pattern.description}\n`;
		if (pattern.examples.length > 0) {
			output += `  Examples: ${pattern.examples.map((e) => `\`${e}\``).join(", ")}\n`;
		}
	}

	// Volatility context
	let volatilityLabel = "stable";
	if (guidance.averageVolatility >= 50) {
		volatilityLabel = "volatile";
	} else if (guidance.averageVolatility >= 25) {
		volatilityLabel = "moderate";
	}
	output += `\nFolder volatility: ${guidance.averageVolatility}% (${volatilityLabel})\n`;

	return output;
}

// --- ENGINE 5: HISTORY SEARCH (The Archaeologist) ---
// Solves "Chesterton's Fence" - why was this code written this way?

// Commit type classification
export type CommitType = "bugfix" | "feature" | "refactor" | "docs" | "test" | "chore" | "unknown";

const COMMIT_TYPE_PATTERNS: Record<Exclude<CommitType, "unknown">, RegExp> = {
	bugfix: /\b(fix|bug|patch|hotfix|resolve|issue|crash|error|regression)\b/i,
	feature: /\b(feat|add|new|implement|support|enable|introduce)\b/i,
	refactor: /\b(refactor|restructure|reorganize|simplify|clean|improve)\b/i,
	docs: /\b(doc|readme|comment|jsdoc|typedef|changelog)\b/i,
	test: /\b(test|spec|coverage|mock|stub|e2e|unit)\b/i,
	chore: /\b(chore|deps|upgrade|bump|ci|build|release|version)\b/i,
};

export function classifyCommit(message: string): CommitType {
	for (const [type, pattern] of Object.entries(COMMIT_TYPE_PATTERNS)) {
		if (pattern.test(message)) return type as CommitType;
	}
	return "unknown";
}

export interface HistorySearchResult {
	hash: string;
	date: string;
	author: string;
	message: string;
	filesChanged: string[];
	matchType: "message" | "diff";
	commitType: CommitType;
	diffSnippet?: string;
	changeType?: "added" | "removed" | "modified";
}

export interface HistorySearchOutput {
	query: string;
	path: string | null;
	results: HistorySearchResult[];
	totalFound: number;
}

export interface HistorySearchOptions {
	query: string;
	filePath?: string;
	searchType?: "message" | "diff" | "both";
	limit?: number;
	startLine?: number;
	endLine?: number;
	since?: string;
	until?: string;
	author?: string;
	includeDiff?: boolean;
	commitTypes?: CommitType[];
}

// Helper to extract diff snippet for a specific commit in history search
async function getHistoryDiffSnippet(
	git: ReturnType<typeof simpleGit>,
	hash: string,
	query: string,
	filePath?: string,
): Promise<{ snippet: string; changeType: "added" | "removed" | "modified" } | null> {
	try {
		const args = ["show", hash, "-p", "--unified=3"];
		if (filePath) {
			// Get relative path from repo root
			const root = (await git.revparse(["--show-toplevel"])).trim();
			args.push("--", path.relative(root, filePath));
		}

		const diff = await git.raw(args);
		return extractRelevantHunk(diff, query);
	} catch {
		return null;
	}
}

// Extract the relevant hunk containing the query
function extractRelevantHunk(
	diff: string,
	query: string,
): { snippet: string; changeType: "added" | "removed" | "modified" } | null {
	if (!query.trim()) return null;

	const lines = diff.split("\n");
	const queryLower = query.toLowerCase();

	// Find lines containing the query
	let matchLineIndex = -1;
	let hasAddition = false;
	let hasRemoval = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const lineLower = line.toLowerCase();

		if (lineLower.includes(queryLower)) {
			if (matchLineIndex === -1) matchLineIndex = i;
			if (line.startsWith("+") && !line.startsWith("+++")) hasAddition = true;
			if (line.startsWith("-") && !line.startsWith("---")) hasRemoval = true;
		}
	}

	if (matchLineIndex === -1) return null;

	// Determine change type
	let changeType: "added" | "removed" | "modified";
	if (hasAddition && hasRemoval) {
		changeType = "modified";
	} else if (hasAddition) {
		changeType = "added";
	} else if (hasRemoval) {
		changeType = "removed";
	} else {
		changeType = "modified"; // Context line match
	}

	// Extract ±5 lines around the match
	const start = Math.max(0, matchLineIndex - 5);
	const end = Math.min(lines.length, matchLineIndex + 6);
	const snippet = lines.slice(start, end).join("\n");

	// Limit snippet size
	if (snippet.length > 500) {
		return { snippet: snippet.slice(0, 500) + "...", changeType };
	}

	return { snippet, changeType };
}

export async function searchHistory(
	queryOrOptions: string | HistorySearchOptions,
	filePath?: string,
	searchType: "message" | "diff" | "both" = "both",
	limit: number = 20,
	startLine?: number,
	endLine?: number,
	since?: string,
	until?: string,
	author?: string,
	includeDiff?: boolean,
	commitTypes?: CommitType[],
): Promise<HistorySearchOutput> {
	// Support both old positional API and new options object API
	let query: string;
	if (typeof queryOrOptions === "object") {
		query = queryOrOptions.query;
		filePath = queryOrOptions.filePath;
		searchType = queryOrOptions.searchType ?? "both";
		limit = queryOrOptions.limit ?? 20;
		startLine = queryOrOptions.startLine;
		endLine = queryOrOptions.endLine;
		since = queryOrOptions.since;
		until = queryOrOptions.until;
		author = queryOrOptions.author;
		includeDiff = queryOrOptions.includeDiff;
		commitTypes = queryOrOptions.commitTypes;
	} else {
		query = queryOrOptions;
	}
	// Determine git context - get repo root first
	const targetPath = filePath || process.cwd();
	const tempGit = getGitForFile(targetPath);

	let repoRoot: string;
	try {
		const root = await tempGit.revparse(["--show-toplevel"]);
		repoRoot = root.trim();
	} catch {
		return { query, path: filePath || null, results: [], totalFound: 0 };
	}

	// Use repo root for git operations so relative paths work correctly
	const git = simpleGit(repoRoot);

	// Cache key includes query, path, search type, line range, AND new filters
	// Normalize startLine in cache key (0 becomes 1 since git is 1-based)
	const normalizedCacheStartLine =
		startLine !== undefined ? Math.max(1, startLine) : undefined;
	const lineRangeKey =
		normalizedCacheStartLine !== undefined && endLine !== undefined
			? `:L${normalizedCacheStartLine}-${endLine}`
			: "";
	const filterKey = [
		since ? `since:${since}` : "",
		until ? `until:${until}` : "",
		author ? `author:${author}` : "",
		commitTypes?.length ? `types:${commitTypes.join(",")}` : "",
	].filter(Boolean).join(":");
	const cacheKey = `history:${query}:${filePath || "all"}:${searchType}${lineRangeKey}${filterKey ? `:${filterKey}` : ""}`;
	if (cache.has(cacheKey)) return cache.get(cacheKey);

	const results: HistorySearchResult[] = [];
	const seenHashes = new Set<string>();

	// LINE-RANGE SEARCH (Sherlock Mode) - git log -L
	if (startLine !== undefined && endLine !== undefined && filePath) {
		try {
			const relativePath = path.relative(repoRoot, filePath);

			// Normalize startLine (git is 1-based, so 0 becomes 1)
			const normalizedStartLine = Math.max(1, startLine);

			// Validate line numbers (after normalization)
			if (endLine < normalizedStartLine) {
				const output: HistorySearchOutput = {
					query,
					path: filePath,
					results: [],
					totalFound: 0,
				};
				cache.set(cacheKey, output);
				return output;
			}

			// Execute git log -L <start>,<end>:<filepath>
			// Note: git log -L output is complex - it interleaves commit info with diffs
			const lineRangeArgs = [
				"log",
				`-L`,
				`${normalizedStartLine},${endLine}:${relativePath}`,
				"--format=%H|%ai|%an|%s",
				`-n`,
				String(limit),
			];
			// Add time-based filters
			if (since) lineRangeArgs.push(`--since=${since}`);
			if (until) lineRangeArgs.push(`--until=${until}`);
			if (author) lineRangeArgs.push(`--author=${author}`);

			const lineRangeOutput = await git.raw(lineRangeArgs).catch(() => "");

			// Parse the output - look for lines matching our format
			const formatLineRegex = /^([0-9a-f]{40})\|(.+?)\|(.+?)\|(.*)$/;

			// Collect commits first, then fetch files in parallel
			const commitsToParse: Array<{
				hash: string;
				date: string;
				author: string;
				message: string;
			}> = [];

			for (const line of lineRangeOutput.split("\n")) {
				const match = line.match(formatLineRegex);
				if (match && !seenHashes.has(match[1])) {
					const [, hash, date, commitAuthor, message] = match;
					seenHashes.add(hash);

					// Filter by query if provided (otherwise show all line-range commits)
					const matchesQuery =
						!query.trim() ||
						message.toLowerCase().includes(query.toLowerCase());

					// Filter by commit type if specified
					const commitType = classifyCommit(message);
					const matchesType = !commitTypes?.length || commitTypes.includes(commitType);

					if (matchesQuery && matchesType) {
						commitsToParse.push({ hash, date, author: commitAuthor, message });
					}
				}
			}

			// Fetch files changed for all commits in parallel
			const filesChangedResults = await mapConcurrent(
				commitsToParse,
				5,
				(commit) =>
					git
						.raw(["show", commit.hash, "--name-only", "--format="])
						.catch(() => ""),
			);

			for (let i = 0; i < commitsToParse.length; i++) {
				const commit = commitsToParse[i];
				const files = filesChangedResults[i]
					.split("\n")
					.filter((f) => f.trim());
				results.push({
					hash: commit.hash.slice(0, 7),
					date: commit.date?.split(" ")[0] || "",
					author: commit.author || "unknown",
					message: commit.message.trim(),
					filesChanged: files.slice(0, 5),
					matchType: "diff", // Line-range is effectively a diff search
					commitType: classifyCommit(commit.message),
				});
			}

			// If line-range was requested, return results directly (don't fall through)
			const sortedResults = results
				.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
				.slice(0, limit);

			// Smart diff snippet default: include if ≤5 results or explicitly requested
			const shouldIncludeDiff = includeDiff ?? (sortedResults.length <= 5);
			if (shouldIncludeDiff && query.trim()) {
				const snippetResults = await mapConcurrent(
					sortedResults,
					5,
					(result) => getHistoryDiffSnippet(git, result.hash, query, filePath),
				);
				for (let i = 0; i < sortedResults.length; i++) {
					const snippet = snippetResults[i];
					if (snippet) {
						sortedResults[i].diffSnippet = snippet.snippet;
						sortedResults[i].changeType = snippet.changeType;
					}
				}
			}

			const output: HistorySearchOutput = {
				query,
				path: filePath,
				results: sortedResults,
				totalFound: sortedResults.length,
			};

			cache.set(cacheKey, output);
			return output;
		} catch {
			// Line-range search failed, fall through to regular search
		}
	}

	// Helper to build git log args with common filters
	const buildLogArgs = (baseArgs: string[]): string[] => {
		const args = [...baseArgs];
		if (since) args.push(`--since=${since}`);
		if (until) args.push(`--until=${until}`);
		if (author) args.push(`--author=${author}`);
		if (filePath) args.push("--", path.relative(repoRoot, filePath));
		return args;
	};

	// Helper to parse git log output into commits
	const parseLogOutput = (
		output: string,
		matchType: "message" | "diff",
	): Array<{ hash: string; date: string; author: string; message: string; matchType: "message" | "diff" }> => {
		const commits: Array<{ hash: string; date: string; author: string; message: string; matchType: "message" | "diff" }> = [];
		for (const line of output.split("\n").filter((l) => l.trim())) {
			const [hash, date, commitAuthor, ...msgParts] = line.split("|");
			if (hash && !seenHashes.has(hash)) {
				const message = msgParts.join("|").trim();
				// Filter by commit type if specified
				const commitType = classifyCommit(message);
				const matchesType = !commitTypes?.length || commitTypes.includes(commitType);
				if (matchesType) {
					seenHashes.add(hash);
					commits.push({ hash, date, author: commitAuthor, message, matchType });
				}
			}
		}
		return commits;
	};

	try {
		// PARALLEL SEARCH: Run message and diff searches concurrently when searchType is "both"
		if (searchType === "both") {
			const messageArgs = buildLogArgs([
				"log", "--grep", query, "-i",
				"--format=%H|%ai|%an|%s", "-n", String(limit),
			]);
			const pickaxeArgs = buildLogArgs([
				"log", "-S", query,
				"--format=%H|%ai|%an|%s", "-n", String(limit),
			]);

			// Run both searches in parallel
			const [messageOutput, pickaxeOutput] = await Promise.all([
				git.raw(messageArgs).catch(() => ""),
				git.raw(pickaxeArgs).catch(() => ""),
			]);

			// Parse results (seenHashes prevents duplicates)
			const messageCommits = parseLogOutput(messageOutput, "message");
			const pickaxeCommits = parseLogOutput(pickaxeOutput, "diff");
			const allCommits = [...messageCommits, ...pickaxeCommits];

			// Fetch files changed for all commits in parallel
			const filesResults = await mapConcurrent(
				allCommits,
				5,
				(commit) => git.raw(["show", commit.hash, "--name-only", "--format="]).catch(() => ""),
			);

			for (let i = 0; i < allCommits.length; i++) {
				const commit = allCommits[i];
				const files = filesResults[i].split("\n").filter((f) => f.trim());
				results.push({
					hash: commit.hash.slice(0, 7),
					date: commit.date?.split(" ")[0] || "",
					author: commit.author || "unknown",
					message: commit.message,
					filesChanged: files.slice(0, 5),
					matchType: commit.matchType,
					commitType: classifyCommit(commit.message),
				});
			}
		} else if (searchType === "message") {
			// Message-only search
			const messageArgs = buildLogArgs([
				"log", "--grep", query, "-i",
				"--format=%H|%ai|%an|%s", "-n", String(limit),
			]);
			const messageOutput = await git.raw(messageArgs).catch(() => "");
			const messageCommits = parseLogOutput(messageOutput, "message");

			const filesResults = await mapConcurrent(
				messageCommits,
				5,
				(commit) => git.raw(["show", commit.hash, "--name-only", "--format="]).catch(() => ""),
			);

			for (let i = 0; i < messageCommits.length; i++) {
				const commit = messageCommits[i];
				const files = filesResults[i].split("\n").filter((f) => f.trim());
				results.push({
					hash: commit.hash.slice(0, 7),
					date: commit.date?.split(" ")[0] || "",
					author: commit.author || "unknown",
					message: commit.message,
					filesChanged: files.slice(0, 5),
					matchType: "message",
					commitType: classifyCommit(commit.message),
				});
			}
		} else {
			// Diff-only search
			const pickaxeArgs = buildLogArgs([
				"log", "-S", query,
				"--format=%H|%ai|%an|%s", "-n", String(limit),
			]);
			const pickaxeOutput = await git.raw(pickaxeArgs).catch(() => "");
			const pickaxeCommits = parseLogOutput(pickaxeOutput, "diff");

			const filesResults = await mapConcurrent(
				pickaxeCommits,
				5,
				(commit) => git.raw(["show", commit.hash, "--name-only", "--format="]).catch(() => ""),
			);

			for (let i = 0; i < pickaxeCommits.length; i++) {
				const commit = pickaxeCommits[i];
				const files = filesResults[i].split("\n").filter((f) => f.trim());
				results.push({
					hash: commit.hash.slice(0, 7),
					date: commit.date?.split(" ")[0] || "",
					author: commit.author || "unknown",
					message: commit.message,
					filesChanged: files.slice(0, 5),
					matchType: "diff",
					commitType: classifyCommit(commit.message),
				});
			}
		}
	} catch {
		// Git operation failed
	}

	// Sort by date (most recent first) and limit
	const sortedResults = results
		.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
		.slice(0, limit);

	// Smart diff snippet default: include if ≤5 results or explicitly requested
	const shouldIncludeDiff = includeDiff ?? (sortedResults.length <= 5);
	if (shouldIncludeDiff && query.trim()) {
		const snippetResults = await mapConcurrent(
			sortedResults,
			5,
			(result) => getHistoryDiffSnippet(git, result.hash, query, filePath),
		);
		for (let i = 0; i < sortedResults.length; i++) {
			const snippet = snippetResults[i];
			if (snippet) {
				sortedResults[i].diffSnippet = snippet.snippet;
				sortedResults[i].changeType = snippet.changeType;
			}
		}
	}

	const output: HistorySearchOutput = {
		query,
		path: filePath || null,
		results: sortedResults,
		totalFound: sortedResults.length,
	};

	cache.set(cacheKey, output);
	return output;
}


// Format history search results for AI consumption
export function formatHistoryResults(output: HistorySearchOutput): string {
	const { query, path: searchPath, results, totalFound } = output;

	let report = `# History Search: "${query}"`;
	if (searchPath) {
		report += ` in \`${path.basename(searchPath)}\``;
	}
	report += "\n\n";

	if (totalFound === 0) {
		report += `**No commits found** matching "${query}".\n\n`;
		report += `**Try:**\n`;
		report += `- Different keywords or variations\n`;
		report += `- Removing the file path to search entire repo\n`;
		report += `- Using \`searchType: "diff"\` to search code changes\n`;
		return report;
	}

	report += `**Found ${totalFound} commits**\n\n`;

	// Check for bug fixes using commitType
	const hasBugFixes = results.some((r) => r.commitType === "bugfix");

	if (hasBugFixes) {
		report += `> [BUGFIX] Bug fixes detected — review commits before modifying this code.\n\n`;
	}

	report += `---\n\n`;

	results.forEach((r, i) => {
		const matchType = r.matchType === "message" ? "msg" : "diff";
		const typeLabel = r.commitType ? `[${r.commitType.toUpperCase()}]` : "";
		report += `**${i + 1}. \`${r.hash}\`** ${r.date} · @${r.author} · ${matchType} ${typeLabel}\n`;
		report += `> ${r.message}\n`;
		if (r.filesChanged.length > 0) {
			report += `Files: ${r.filesChanged.map((f) => `\`${f}\``).join(", ")}\n`;
		}
		// Show diff snippet if available
		if (r.diffSnippet) {
			const changeLabel = r.changeType === "added" ? "+" : r.changeType === "removed" ? "-" : "~";
			report += `\n**Code Change (${changeLabel}):**\n\`\`\`diff\n${r.diffSnippet}\n\`\`\`\n`;
		}
		report += "\n";
	});

	// Extract unique files from results for checklist
	const relatedFiles = new Set<string>();
	results.forEach((r) => r.filesChanged.forEach((f) => relatedFiles.add(f)));
	const topFiles = [...relatedFiles].slice(0, 5);

	if (topFiles.length > 0) {
		report += `---\n\n`;
		report += `## Before Modifying\n\n`;
		topFiles.forEach((f) => {
			report += `- [ ] Review \`${f}\`\n`;
		});
		if (hasBugFixes) {
			report += `- [ ] Verify bug fixes are no longer relevant\n`;
		}
	}

	return report;
}

// --- ENGINE 4: VOLATILITY (Enhanced with Time Decay, Author Tracking + Config) ---
export async function getVolatility(
	filePath: string,
	configOrContext?: MemoriaConfig | null | AnalysisContext,
): Promise<VolatilityResult> {
	// Determine if we received a context or just config
	const ctx =
		configOrContext && "git" in configOrContext
			? (configOrContext as AnalysisContext)
			: null;
	const config = ctx ? ctx.config : (configOrContext as MemoriaConfig | null);

	// Include config in cache key if custom keywords are specified
	const configKey = getStableConfigKey(config);
	const cacheKey = `volatility:${filePath}:${configKey}`;
	if (cache.has(cacheKey)) return cache.get(cacheKey);

	// Use context if provided, otherwise initialize (backward compatibility)
	const git = ctx ? ctx.git : getGitForFile(filePath);
	const log = await git.log({ file: filePath, maxCount: 20 });

	// Get effective panic keywords (base + config overrides)
	const panicKeywords = getEffectivePanicKeywords(config);

	let weightedPanicScore = 0;
	const maxPossibleScore = 20 * 3; // 20 commits × max weight of 3
	const panicCommits: string[] = [];

	// Track author contributions (Bus Factor)
	const authorMap: Map<
		string,
		{
			name: string;
			email: string;
			commits: number;
			firstCommit: Date;
			lastCommit: Date;
		}
	> = new Map();

	// Track decay stats
	let totalDecay = 0;
	let oldestDays = 0;
	let newestDays = Infinity;

	log.all.forEach((c) => {
		const msgLower = c.message.toLowerCase();
		let commitWeight = 0;

		// Find the highest weight keyword match in this commit
		for (const [keyword, weight] of Object.entries(panicKeywords)) {
			if (msgLower.includes(keyword)) {
				commitWeight = Math.max(commitWeight, weight);
			}
		}

		// Apply time decay to the commit weight
		const commitDate = new Date(c.date);
		const decay = calculateRecencyDecay(commitDate);
		const daysAgo = Math.floor(
			(Date.now() - commitDate.getTime()) / (1000 * 60 * 60 * 24),
		);

		// Track decay stats
		totalDecay += decay;
		oldestDays = Math.max(oldestDays, daysAgo);
		if (daysAgo < newestDays) newestDays = daysAgo;

		if (commitWeight > 0) {
			// Apply decay to the weighted score (recency bias)
			weightedPanicScore += commitWeight * decay;
			// Track high-severity commits for output (regardless of decay)
			if (commitWeight >= 2) {
				panicCommits.push(c.message.split("\n")[0].slice(0, 60));
			}
		}

		// Track author contributions
		const authorKey = c.author_email || c.author_name;
		const existing = authorMap.get(authorKey);
		if (existing) {
			existing.commits++;
			if (commitDate < existing.firstCommit) existing.firstCommit = commitDate;
			if (commitDate > existing.lastCommit) existing.lastCommit = commitDate;
		} else {
			authorMap.set(authorKey, {
				name: c.author_name,
				email: c.author_email,
				commits: 1,
				firstCommit: commitDate,
				lastCommit: commitDate,
			});
		}
	});

	// Build sorted author contributions
	const totalCommits = log.total || 1; // Avoid division by zero
	const authorDetails: AuthorContribution[] = Array.from(authorMap.values())
		.map((a) => ({
			name: a.name,
			email: a.email,
			commits: a.commits,
			percentage: Math.round((a.commits / totalCommits) * 100),
			firstCommit: a.firstCommit.toISOString().split("T")[0],
			lastCommit: a.lastCommit.toISOString().split("T")[0],
		}))
		.sort((a, b) => b.commits - a.commits);

	// Identify top author (bus factor indicator)
	const topAuthor = authorDetails.length > 0 ? authorDetails[0] : null;

	const result: VolatilityResult = {
		commitCount: log.total,
		panicScore: Math.min(
			100,
			Math.round((weightedPanicScore / maxPossibleScore) * 100),
		),
		panicCommits: panicCommits.slice(0, 3), // Top 3 concerning commits
		lastCommitDate: log.latest?.date,
		authors: authorMap.size, // Backward compatible count
		authorDetails,
		topAuthor,
		recencyDecay: {
			oldestCommitDays: oldestDays,
			newestCommitDays: newestDays === Infinity ? 0 : newestDays,
			decayFactor:
				log.total > 0 ? Math.round((totalDecay / log.total) * 100) / 100 : 1,
		},
	};

	cache.set(cacheKey, result);
	return result;
}

// --- COMPOUND RISK CALCULATOR (Enhanced with Static Import Awareness + Config Weights) ---
export function calculateCompoundRisk(
	volatility: { panicScore: number; commitCount: number },
	coupled: { file: string; score: number }[],
	drift: { file: string; daysOld: number }[],
	importers: string[] = [],
	config?: MemoriaConfig | null,
): RiskAssessment {
	// Get weights from config or use defaults
	const weights = getEffectiveRiskWeights(config);
	const VOLATILITY_WEIGHT = weights.volatility;
	const COUPLING_WEIGHT = weights.coupling;
	const DRIFT_WEIGHT = weights.drift;
	const IMPORTER_WEIGHT = weights.importers;

	// Normalize volatility component (already 0-100)
	const volatilityComponent = volatility.panicScore;

	// Coupling component: Average of top 3 coupling scores, scaled up
	const couplingScores = coupled.slice(0, 3).map((c) => c.score);
	const couplingComponent =
		couplingScores.length > 0
			? Math.min(
					100,
					(couplingScores.reduce((a, b) => a + b, 0) / couplingScores.length) *
						1.5,
				)
			: 0;

	// Drift component: Penalty based on staleness (each stale file adds 25 points, max 100)
	const driftComponent = Math.min(100, drift.length * 25);

	// Importer component: More importers = higher risk when making changes
	// Scale: 0 importers = 0, 5+ importers = 50, 10+ importers = 100
	const importerComponent = Math.min(100, importers.length * 10);

	// Calculate compound score
	const score = Math.round(
		volatilityComponent * VOLATILITY_WEIGHT +
			couplingComponent * COUPLING_WEIGHT +
			driftComponent * DRIFT_WEIGHT +
			importerComponent * IMPORTER_WEIGHT,
	);

	// Collect risk factors
	const factors: string[] = [];
	if (volatilityComponent > 30)
		factors.push(`High volatility (${volatilityComponent}% panic score)`);
	if (coupled.length >= 3)
		factors.push(`Tightly coupled (${coupled.length} files)`);
	if (drift.length > 0) factors.push(`${drift.length} stale dependencies`);
	if (importers.length >= 5)
		factors.push(`Heavily imported (${importers.length} files depend on this)`);
	if (volatility.commitCount === 0) factors.push("No git history (new file)");

	// Determine level and action
	let level: RiskAssessment["level"];
	let action: string;

	if (score >= 75) {
		level = "critical";
		action =
			"STOP. Review all coupled files before any changes. Run tests after every edit.";
	} else if (score >= 50) {
		level = "high";
		action =
			"Proceed carefully. Check all coupled files and update stale dependencies.";
	} else if (score >= 25) {
		level = "medium";
		action = "Standard caution. Verify coupled files are still compatible.";
	} else {
		level = "low";
		action = "Safe to proceed with normal development practices.";
	}

	return { score, level, factors, action };
}

// --- OUTPUT FORMATTER (Clean, hierarchical design for AI consumption) ---
export function generateAiInstructions(
	filePath: string,
	volatility: any,
	coupled: any[],
	drift: any[],
	importers: string[] = [],
	config?: MemoriaConfig | null,
	siblingGuidance?: SiblingGuidance | null,
) {
	const fileName = path.basename(filePath);

	// Calculate compound risk score (now includes importer count and config weights)
	const risk = calculateCompoundRisk(
		volatility,
		coupled,
		drift,
		importers,
		config,
	);

	// Build compact risk factors string
	const riskFactorParts: string[] = [];
	if (volatility.panicScore > 0) riskFactorParts.push(`${volatility.panicScore}% volatility`);
	if (coupled.length > 0) riskFactorParts.push(`${coupled.length} coupled`);
	if (importers.length > 0) riskFactorParts.push(`${importers.length} dependents`);
	if (drift.length > 0) riskFactorParts.push(`${drift.length} stale`);
	const riskFactorsCompact = riskFactorParts.join(" · ");

	// Build output
	let output = "";

	// ══════════════════════════════════════════════════════════════════════════════
	// HEADER: File name + Risk Score
	// ══════════════════════════════════════════════════════════════════════════════
	output += `# Forensics: \`${fileName}\`\n\n`;

	// Risk score badge
	const riskLabel = risk.level.toUpperCase();
	output += `**RISK: ${risk.score}/100** — ${riskLabel}\n`;
	if (riskFactorsCompact) {
		output += `${riskFactorsCompact}\n`;
	}
	output += `\n`;

	// Action recommendation (only for medium+ risk)
	if (risk.level !== "low") {
		output += `> ${risk.action}\n\n`;
	}

	// ══════════════════════════════════════════════════════════════════════════════
	// SECTION: Coupled Files
	// ══════════════════════════════════════════════════════════════════════════════
	if (coupled.length > 0) {
		output += `---\n\n`;
		output += `## Coupled Files\n\n`;

		// Source label mapping
		const SOURCE_LABELS: Record<string, string> = {
			git: "",           // No label for git (default/historical)
			docs: "docs",
			type: "type",
			content: "content",
			test: "test",      // Engine 9: Test file coupling
			env: "env",        // Engine 10: Environment variable coupling
			schema: "schema",  // Engine 11: Schema/model coupling
			api: "api",        // Engine 12: API endpoint coupling
			transitive: "transitive", // Engine 13: Re-export chain coupling
		};

		// Source-specific instructions
		const SOURCE_INSTRUCTIONS: Record<string, string> = {
			docs: "Documentation references this file. Update docs if you change the API.",
			type: "Shares type definitions. Interface changes may require updates here.",
			content: "Contains shared literals. Ensure consistency across files.",
			test: "Test file for this module. Update tests when changing exports.",
			env: "Shares environment variables. Ensure values are consistent.",
			schema: "References same schema/model. Changes may break queries.",
			api: "Calls endpoints from this file. Response changes will break this.",
			transitive: "Imports via barrel/re-export. Indirect dependency.",
		};

		coupled.forEach((c) => {
			const evidence: DiffSummary | string | undefined = c.evidence;
			const source: CouplingSource = c.source || "git";
			const sourceLabel = SOURCE_LABELS[source];

			// For git coupling, use the existing relationship logic
			let relationship = "unknown";
			if (source === "git" && typeof evidence === "object" && evidence?.changeType) {
				relationship = evidence.changeType;
			}

			// File name with coupling percentage and source label
			output += `**\`${c.file}\`** — ${c.score}%`;
			if (sourceLabel) {
				output += ` [${sourceLabel}]`;
			} else if (relationship !== "unknown") {
				output += ` (${relationship})`;
			}
			output += `\n`;

			// Instruction based on source or relationship
			if (source !== "git" && SOURCE_INSTRUCTIONS[source]) {
				output += `> ${SOURCE_INSTRUCTIONS[source]}\n`;
			} else if (source === "git") {
				output += `> ${RELATIONSHIP_INSTRUCTIONS[relationship as ChangeType] || RELATIONSHIP_INSTRUCTIONS.unknown}\n`;
			}

			// Show reason for non-git coupling types
			if (source !== "git" && c.reason) {
				output += `> ${c.reason}\n`;
			}

			// Breaking change warning (git coupling only)
			if (source === "git" && typeof evidence === "object" && evidence?.hasBreakingChange) {
				output += `> WARNING: Breaking change detected in last co-commit\n`;
			}

			// Compact diff evidence (git coupling only)
			if (source === "git" && typeof evidence === "object" && evidence && (evidence.additions.length > 0 || evidence.removals.length > 0)) {
				const diffLines: string[] = [];
				if (evidence.additions.length > 0) {
					diffLines.push(`+ ${evidence.additions.slice(0, 2).join(", ")}`);
				}
				if (evidence.removals.length > 0) {
					diffLines.push(`- ${evidence.removals.slice(0, 2).join(", ")}`);
				}
				output += `\`\`\`diff\n${diffLines.join("\n")}\n\`\`\`\n`;
			}

			output += `\n`;
		});
	}

	// ══════════════════════════════════════════════════════════════════════════════
	// SECTION: Static Dependents (files that import this file)
	// ══════════════════════════════════════════════════════════════════════════════
	if (importers.length > 0) {
		output += `---\n\n`;
		output += `## Static Dependents\n\n`;
		output += `These files import \`${fileName}\`. API changes require updating them.\n\n`;

		importers.slice(0, 8).forEach((file) => {
			output += `- [ ] \`${file}\`\n`;
		});

		if (importers.length > 8) {
			output += `- ... and ${importers.length - 8} more\n`;
		}
		output += `\n`;
	}

	// ══════════════════════════════════════════════════════════════════════════════
	// SECTION: Pre-flight Checklist
	// ══════════════════════════════════════════════════════════════════════════════
	output += `---\n\n`;
	output += `## Pre-flight Checklist\n\n`;

	// Primary target
	output += `- [ ] Modify \`${fileName}\`\n`;

	// Coupled files
	coupled.forEach((c) => {
		const source: CouplingSource = c.source || "git";
		const evidence = c.evidence;
		let relationship = "unknown";
		if (source === "git" && typeof evidence === "object" && evidence?.changeType) {
			relationship = evidence.changeType;
		}
		const staleInfo = drift.find((d) => d.file === c.file);

		// Build suffix based on source type
		let suffix = "";
		if (source !== "git") {
			suffix = ` [${source}]`;
		} else if (relationship !== "unknown") {
			suffix = ` (${relationship})`;
		}
		if (staleInfo) {
			suffix += ` — stale ${staleInfo.daysOld}d`;
		}
		output += `- [ ] Update \`${c.file}\`${suffix}\n`;
	});

	// Stale files not in coupled
	const coupledFileSet = new Set(coupled.map((c) => c.file));
	drift.filter((d) => !coupledFileSet.has(d.file)).forEach((d) => {
		output += `- [ ] Update \`${d.file}\` — stale ${d.daysOld}d\n`;
	});

	// Top importers not already in coupled
	const newImporters = importers.filter((f) => !coupledFileSet.has(f));
	newImporters.slice(0, 3).forEach((file) => {
		output += `- [ ] Verify \`${file}\` (importer)\n`;
	});
	if (newImporters.length > 3) {
		output += `- ... and ${newImporters.length - 3} more importers\n`;
	}

	output += `\n`;

	// ══════════════════════════════════════════════════════════════════════════════
	// SECTION: File History (volatility details)
	// ══════════════════════════════════════════════════════════════════════════════
	if (volatility.commitCount === 0) {
		output += `---\n\n`;
		output += `## File History\n\n`;
		output += `**New file** — no git history available.\n\n`;

		// Sibling guidance for new files
		if (siblingGuidance && siblingGuidance.patterns.length > 0) {
			output += formatSiblingGuidance(siblingGuidance);
		}
	} else if (volatility.panicScore > 25 || volatility.topAuthor?.percentage >= 70) {
		// Only show history section if there's something notable
		output += `---\n\n`;
		output += `## File History\n\n`;

		// Volatility status
		if (volatility.panicScore > 50) {
			output += `**Volatile** — ${volatility.panicScore}% panic score\n`;
		} else if (volatility.panicScore > 25) {
			output += `**Moderate churn** — ${volatility.panicScore}% panic score\n`;
		}

		// Recency context
		if (volatility.recencyDecay) {
			if (volatility.recencyDecay.newestCommitDays <= 14 && volatility.panicScore > 25) {
				output += `Recent bug fixes in the last ${volatility.recencyDecay.newestCommitDays} days.\n`;
			}
		}

		// Bus Factor warning
		if (volatility.topAuthor && volatility.topAuthor.percentage >= 70) {
			output += `**Expert:** ${volatility.topAuthor.name} (${volatility.topAuthor.percentage}% of commits)\n`;
		}

		// Concerning commits
		if (volatility.panicCommits && volatility.panicCommits.length > 0) {
			output += `\n**Recent issues:**\n`;
			volatility.panicCommits.slice(0, 3).forEach((msg: string) => {
				output += `- "${msg}"\n`;
			});
		}

		output += `\n`;
	}

	return output;
}

// --- SERVER FACTORY (for Smithery) ---
export default function createServer(_options?: { config?: Record<string, unknown> }) {
	const server = new Server(
		{ name: "memoria", version: "1.0.0" },
		{ capabilities: { tools: {}, prompts: {}, resources: {} } },
	);

	return setupServer(server);
}

// Setup server handlers and return the server
function setupServer(server: Server): Server {
	server.setRequestHandler(ListToolsRequestSchema, async () => ({
		tools: [
			{
				name: "analyze_file",
				description:
					"Returns forensic history, hidden dependencies, and risk assessment. USE THIS before modifying files.",
				inputSchema: {
					type: "object",
					properties: {
						path: {
							type: "string",
							description:
								"The ABSOLUTE path to the file (e.g. C:/dev/project/src/file.ts)",
						},
					},
					required: ["path"],
				},
				annotations: {
					title: "Analyze File",
					readOnlyHint: true,
					idempotentHint: true,
					openWorldHint: false,
				},
			},
			{
				name: "ask_history",
				description:
					"Search git history for WHY code was written. IMPORTANT: Use SHORT, SPECIFIC KEYWORDS (e.g., 'serialization', 'race condition', 'timeout'). Do NOT use full sentences or long descriptions - they will return 0 results. Use when asking 'why does this exist?' or before removing code.",
				inputSchema: {
					type: "object",
					properties: {
						query: {
							type: "string",
							description:
								"A single keyword or short phrase (1-3 words max). Examples: 'serialization', 'race condition', 'Safari fix'. Do NOT use full sentences - git grep requires exact matches.",
						},
						path: {
							type: "string",
							description:
								"Optional: ABSOLUTE path to scope search to a specific file or directory",
						},
						searchType: {
							type: "string",
							enum: ["message", "diff", "both"],
							description:
								"Where to search: 'message' (commit messages only), 'diff' (code changes only), 'both' (default)",
						},
						limit: {
							type: "number",
							description: "Maximum number of results to return (default: 20)",
						},
						startLine: {
							type: "number",
							description:
								"Start line for line-range search (requires path). Shows history of specific lines using git log -L.",
						},
						endLine: {
							type: "number",
							description:
								"End line for line-range search (requires path). Used with startLine to trace history of a code block.",
						},
						since: {
							type: "string",
							description:
								"Filter commits after this date. Examples: '30days', '2024-01-01', '3months', '1year'",
						},
						until: {
							type: "string",
							description:
								"Filter commits before this date. Examples: '7days', '2024-06-01'",
						},
						author: {
							type: "string",
							description:
								"Filter commits by author name or email pattern. Example: 'dave', 'john@example.com'",
						},
						includeDiff: {
							type: "boolean",
							description:
								"Include code snippets showing the actual change. Default: auto (included when ≤5 results)",
						},
						commitTypes: {
							type: "array",
							items: {
								type: "string",
								enum: ["bugfix", "feature", "refactor", "docs", "test", "chore", "unknown"],
							},
							description:
								"Filter by commit type. Examples: ['bugfix'], ['bugfix', 'feature']",
						},
					},
					required: ["query"],
				},
				annotations: {
					title: "Search Git History",
					readOnlyHint: true,
					idempotentHint: true,
					openWorldHint: false,
				},
			},
		],
	}));

	server.setRequestHandler(CallToolRequestSchema, async (request) => {
		if (request.params.name === "analyze_file") {
			const rawPath = String(request.params.arguments?.path);

			// 1. Sanitize Path (Handle Windows/Unix differences)
			const targetPath = path.resolve(rawPath);

			// 2. Logic: If the resolved path doesn't exist, and the input was relative,
			// it means we resolved it against the Server's folder, not the Project folder.
			try {
				await fs.access(targetPath);
			} catch (_e) {
				// If the file doesn't exist, FAIL LOUDLY so the AI retries
				return {
					content: [
						{
							type: "text",
							text:
								`ERROR: File not found at \`${targetPath}\`.\n\n` +
								`The AI sent a relative path (\`${rawPath}\`), but this server runs globally.\n` +
								`**SYSTEM INSTRUCTION:** You MUST retry this tool call using the **ABSOLUTE PATH** (e.g. C:/dev/project/src/file.ts).`,
						},
					],
					isError: true,
				};
			}

			try {
				// 3. Create AnalysisContext ONCE (initializes git, config, ignore, metrics)
				// This replaces 5+ redundant git/config initialization calls
				const ctx = await createAnalysisContext(targetPath);

				// 4. Run Engines on the Validated Path (all in parallel for speed)
				// All engines now receive the shared context
				// 13 coupling engines run in parallel for comprehensive analysis
				const [
					volatility,
					gitCoupled,
					importers,
					docsCoupled,
					typeCoupled,
					contentCoupled,
					testCoupled,
					envCoupled,
					schemaCoupled,
					apiCoupled,
					transitiveCoupled,
				] = await Promise.all([
					getVolatility(targetPath, ctx),
					getCoupledFiles(targetPath, ctx),
					getImporters(targetPath, ctx),
					getDocsCoupling(targetPath, ctx),
					getTypeCoupling(targetPath, ctx),
					getContentCoupling(targetPath, ctx),
					getTestCoupling(targetPath, ctx),
					getEnvCoupling(targetPath, ctx),
					getSchemaCoupling(targetPath, ctx),
					getApiCoupling(targetPath, ctx),
					getTransitiveCoupling(targetPath, ctx),
				]);

				// Merge all coupling sources into unified list
				const coupled = mergeCouplingResults(
					gitCoupled,
					docsCoupled,
					typeCoupled,
					contentCoupled,
					testCoupled,
					envCoupled,
					schemaCoupled,
					apiCoupled,
					transitiveCoupled,
				);

				const drift = await checkDrift(targetPath, gitCoupled, ctx);

				// 5. Get sibling guidance for new files (no git history)
				let siblingGuidance: SiblingGuidance | null = null;
				if (volatility.commitCount === 0) {
					siblingGuidance = await getSiblingGuidance(targetPath, ctx.config);
				}

				const report = generateAiInstructions(
					targetPath,
					volatility,
					coupled,
					drift,
					importers,
					ctx.config,
					siblingGuidance,
				);

				return { content: [{ type: "text", text: report }] };
			} catch (error: any) {
				// Check for common git-related errors
				const errorMsg = error.message || String(error);
				const isGitError =
					errorMsg.includes("not a git repository") ||
					errorMsg.includes("Cannot find git root") ||
					errorMsg.includes("git") && errorMsg.includes("fatal");

				if (isGitError) {
					return {
						content: [
							{
								type: "text",
								text:
									`**Git Repository Required**\n\n` +
									`This file is not inside a git repository. Memoria requires git history to analyze file dependencies and risks.\n\n` +
									`**To use Memoria:**\n` +
									`1. Navigate to a directory that is a git repository\n` +
									`2. Provide the absolute path to a file within that repository`,
							},
						],
					};
				}

				return {
					content: [{ type: "text", text: `Analysis Error: ${errorMsg}` }],
					isError: true,
				};
			}
		}

		if (request.params.name === "ask_history") {
			const query = String(request.params.arguments?.query || "");
			const rawPath = request.params.arguments?.path as string | undefined;
			const searchType =
				(request.params.arguments?.searchType as "message" | "diff" | "both") ||
				"both";
			const limit = Number(request.params.arguments?.limit) || 20;
			const startLine = request.params.arguments?.startLine as number | undefined;
			const endLine = request.params.arguments?.endLine as number | undefined;
			// New parameters
			const since = request.params.arguments?.since as string | undefined;
			const until = request.params.arguments?.until as string | undefined;
			const author = request.params.arguments?.author as string | undefined;
			const includeDiff = request.params.arguments?.includeDiff as boolean | undefined;
			const commitTypes = request.params.arguments?.commitTypes as CommitType[] | undefined;

			// Empty query is allowed for line-range search (Sherlock Mode)
			// but required for regular message/diff search
			const isLineRangeSearch = startLine !== undefined && endLine !== undefined;
			if (!query.trim() && !isLineRangeSearch) {
				return {
					content: [
						{
							type: "text",
							text:
								`ERROR: Query is required.\n\n` +
								`**SYSTEM INSTRUCTION:** Provide a keyword to search for (e.g., "setTimeout", "authentication", "fix race condition").\n` +
								`For line-range search (Sherlock Mode), you can use an empty query with startLine/endLine.`,
						},
					],
					isError: true,
				};
			}

			// Validate line-range parameters
			if ((startLine !== undefined || endLine !== undefined) && !rawPath) {
				return {
					content: [
						{
							type: "text",
							text:
								`ERROR: Line-range search requires a file path.\n\n` +
								`**SYSTEM INSTRUCTION:** Provide both \`path\` and \`startLine\`/\`endLine\` for line-range search.`,
						},
					],
					isError: true,
				};
			}

			if (startLine !== undefined && endLine !== undefined) {
				// Normalize startLine (0 becomes 1 since git is 1-based) before validation
				const normalizedStart = Math.max(1, startLine);
				if (normalizedStart > endLine) {
					return {
						content: [
							{
								type: "text",
								text:
									`ERROR: Invalid line range (${startLine}-${endLine}).\n\n` +
									`**SYSTEM INSTRUCTION:** startLine must be <= endLine (note: startLine 0 is treated as 1).`,
							},
						],
						isError: true,
					};
				}
			}

			try {
				// Resolve path if provided
				let targetPath: string | undefined;
				if (rawPath) {
					targetPath = path.resolve(rawPath);
					try {
						await fs.access(targetPath);
					} catch {
						return {
							content: [
								{
									type: "text",
									text:
										`ERROR: Path not found at \`${targetPath}\`.\n\n` +
										`**SYSTEM INSTRUCTION:** Use an ABSOLUTE path or omit the path to search the entire repository.`,
								},
							],
							isError: true,
						};
					}
				}

				const results = await searchHistory({
					query,
					filePath: targetPath,
					searchType,
					limit,
					startLine,
					endLine,
					since,
					until,
					author,
					includeDiff,
					commitTypes,
				});
				const report = formatHistoryResults(results);

				return { content: [{ type: "text", text: report }] };
			} catch (error: any) {
				// Check for common git-related errors
				const errorMsg = error.message || String(error);
				const isGitError =
					errorMsg.includes("not a git repository") ||
					errorMsg.includes("Cannot find git root") ||
					errorMsg.includes("git") && errorMsg.includes("fatal");

				if (isGitError) {
					return {
						content: [
							{
								type: "text",
								text:
									`**Git Repository Required**\n\n` +
									`This operation requires a git repository. Memoria searches git history to find why code was written.\n\n` +
									`**To use Memoria:**\n` +
									`1. Run this command from within a git repository\n` +
									`2. Or provide a path to a file inside a git repository`,
							},
						],
					};
				}

				return {
					content: [
						{ type: "text", text: `History Search Error: ${errorMsg}` },
					],
					isError: true,
				};
			}
		}

		throw new Error("Tool not found");
	});

	// --- PROMPTS ---
	server.setRequestHandler(ListPromptsRequestSchema, async () => ({
		prompts: [
			{
				name: "analyze_before_edit",
				description:
					"Run file analysis before modifying code to understand hidden dependencies and risks",
				arguments: [
					{
						name: "path",
						description: "Absolute path to the file to analyze",
						required: true,
					},
				],
			},
			{
				name: "understand_code_history",
				description:
					"Search git history to understand why code exists before changing or removing it",
				arguments: [
					{
						name: "query",
						description: "Keyword to search for in git history",
						required: true,
					},
					{
						name: "path",
						description: "Optional file path to scope the search",
						required: false,
					},
				],
			},
		],
	}));

	server.setRequestHandler(GetPromptRequestSchema, async (request) => {
		const { name, arguments: args } = request.params;

		if (name === "analyze_before_edit") {
			const filePath = args?.path || "[FILE_PATH]";
			return {
				messages: [
					{
						role: "user",
						content: {
							type: "text",
							text: `Before modifying the file at ${filePath}, analyze it for hidden dependencies and risks using the analyze_file tool. Review the risk score and coupled files before making changes.`,
						},
					},
				],
			};
		}

		if (name === "understand_code_history") {
			const query = args?.query || "[QUERY]";
			const filePath = args?.path;
			const scopeText = filePath ? ` in ${filePath}` : "";
			return {
				messages: [
					{
						role: "user",
						content: {
							type: "text",
							text: `Search the git history for "${query}"${scopeText} using the ask_history tool to understand why this code was written before modifying or removing it.`,
						},
					},
				],
			};
		}

		throw new Error(`Prompt not found: ${name}`);
	});

	// --- RESOURCES ---
	server.setRequestHandler(ListResourcesRequestSchema, async () => ({
		resources: [
			{
				uri: "memoria://defaults",
				name: "Memoria Default Configuration",
				description:
					"Default configuration values used when no .memoria.json is present",
				mimeType: "application/json",
			},
		],
	}));

	server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
		const { uri } = request.params;

		if (uri === "memoria://defaults") {
			const defaults = {
				thresholds: {
					couplingPercent: 15,
					driftDays: 7,
					analysisWindow: 50,
					maxFilesPerCommit: 15,
				},
				riskWeights: {
					volatility: 0.35,
					coupling: 0.3,
					drift: 0.2,
					importers: 0.15,
				},
			};
			return {
				contents: [
					{
						uri,
						mimeType: "application/json",
						text: JSON.stringify(defaults, null, 2),
					},
				],
			};
		}

		throw new Error(`Resource not found: ${uri}`);
	});

	return server;
}

// --- STDIO STARTUP (for CLI usage) ---
// Only run when executed directly, not when imported by Smithery
const isDirectExecution = process.argv[1]?.includes("index") || process.argv[1]?.includes("memoria");
if (isDirectExecution) {
	const server = createServer();
	const transport = new StdioServerTransport();
	server.connect(transport);
}
