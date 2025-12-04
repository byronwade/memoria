#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import simpleGit from "simple-git";
import fs from "fs/promises";
import { LRUCache } from "lru-cache";
import path from "path";
import ignore from "ignore";
import { z } from "zod";

// --- CONFIGURATION & CACHE ---
// Cache results for 5 minutes
export const cache = new LRUCache<string, any>({ max: 100, ttl: 1000 * 60 * 5 });

// --- CONFIGURATION SCHEMA (.memoria.json) ---
const MemoriaConfigSchema = z.object({
	thresholds: z.object({
		couplingPercent: z.number().min(0).max(100).optional(),
		driftDays: z.number().min(1).max(365).optional(),
		analysisWindow: z.number().min(10).max(500).optional(),
	}).optional(),
	ignore: z.array(z.string()).optional(),
	panicKeywords: z.record(z.string(), z.number()).optional(),
	riskWeights: z.object({
		volatility: z.number().min(0).max(1).optional(),
		coupling: z.number().min(0).max(1).optional(),
		drift: z.number().min(0).max(1).optional(),
		importers: z.number().min(0).max(1).optional(),
	}).optional(),
}).strict();

export type MemoriaConfig = z.infer<typeof MemoriaConfigSchema>;

// Load and validate .memoria.json config file (cached)
export async function loadConfig(repoRoot: string): Promise<MemoriaConfig | null> {
	const cacheKey = `config:${repoRoot}`;
	if (cache.has(cacheKey)) return cache.get(cacheKey);

	try {
		const configPath = path.join(repoRoot, '.memoria.json');
		const content = await fs.readFile(configPath, 'utf8');
		const parsed = JSON.parse(content);
		const validated = MemoriaConfigSchema.parse(parsed);
		cache.set(cacheKey, validated);
		return validated;
	} catch (e) {
		// Config doesn't exist or is invalid - use defaults
		cache.set(cacheKey, null);
		return null;
	}
}

// Get effective panic keywords (base + config overrides)
export function getEffectivePanicKeywords(config: MemoriaConfig | null | undefined): Record<string, number> {
	if (!config?.panicKeywords) return PANIC_KEYWORDS;
	return { ...PANIC_KEYWORDS, ...config.panicKeywords };
}

// Get effective risk weights (base + config overrides)
export function getEffectiveRiskWeights(config: MemoriaConfig | null | undefined): {
	volatility: number;
	coupling: number;
	drift: number;
	importers: number;
} {
	const defaults = {
		volatility: 0.35,
		coupling: 0.30,
		drift: 0.20,
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
export type ChangeType = 'schema' | 'api' | 'config' | 'import' | 'test' | 'style' | 'unknown';

export interface DiffSummary {
	additions: string[];        // Lines added (max 10)
	removals: string[];         // Lines removed (max 10)
	hunks: number;              // Number of change hunks (complexity indicator)
	netChange: number;          // additions - removals
	hasBreakingChange: boolean; // Detected breaking patterns
	changeType: ChangeType;     // Classified relationship type
}

export interface RiskAssessment {
	score: number;              // 0-100 compound risk score
	level: 'low' | 'medium' | 'high' | 'critical';
	factors: string[];          // Human-readable risk factors
	action: string;             // Recommended action
}

// --- AUTHOR CONTRIBUTION (Bus Factor) ---
export interface AuthorContribution {
	name: string;
	email: string;
	commits: number;
	percentage: number;
	firstCommit: string;   // ISO date
	lastCommit: string;    // ISO date
}

// --- VOLATILITY RESULT (with time decay and author details) ---
export interface VolatilityResult {
	// Existing fields (backward compatible)
	commitCount: number;
	panicScore: number;           // 0-100, now with time decay
	panicCommits: string[];       // Top 3 concerning commits
	lastCommitDate: string | undefined;
	authors: number;              // Backward compatible count
	// NEW fields
	authorDetails: AuthorContribution[];  // Full author breakdown
	topAuthor: AuthorContribution | null; // Bus factor indicator
	recencyDecay: {
		oldestCommitDays: number;
		newestCommitDays: number;
		decayFactor: number;     // Average decay multiplier applied
	};
}

// --- PANIC KEYWORDS WITH SEVERITY WEIGHTS ---
export const PANIC_KEYWORDS: Record<string, number> = {
	// Critical (3x weight) - security and data integrity issues
	security: 3, vulnerability: 3, cve: 3, exploit: 3,
	crash: 3, 'data loss': 3, corruption: 3, breach: 3,

	// High (2x weight) - urgent fixes and breaking changes
	revert: 2, hotfix: 2, urgent: 2, breaking: 2,
	critical: 2, emergency: 2, rollback: 2, regression: 2,

	// Normal (1x weight) - standard bug fixes
	fix: 1, bug: 1, patch: 1, oops: 1, typo: 1,
	issue: 1, error: 1, wrong: 1, mistake: 1, broken: 1,

	// Low (0.5x weight) - maintenance work
	refactor: 0.5, cleanup: 0.5, lint: 0.5, format: 0.5,
};

// --- TIME DECAY CALCULATION ---
// Calculate time-decay factor: risk drops by 50% every 30 days
export function calculateRecencyDecay(commitDate: Date): number {
	const now = Date.now();
	const daysAgo = Math.floor((now - commitDate.getTime()) / (1000 * 60 * 60 * 24));
	return Math.pow(0.5, daysAgo / 30);
}

// --- RELATIONSHIP-SPECIFIC INSTRUCTIONS ---
export const RELATIONSHIP_INSTRUCTIONS: Record<ChangeType, string> = {
	schema: 'These files share type definitions. If you modify types in one, update the other to match.',
	api: 'These files share an API contract. Signature changes require updates to both caller and callee.',
	config: 'These files share configuration. Ensure config keys match between files.',
	import: 'These files have import dependencies. Check for circular imports or missing exports.',
	test: 'This is a test file coupling. Ensure test mocks/fixtures still match the implementation.',
	style: 'These files had formatting changes together. Likely coincidental - verify actual relationship.',
	unknown: 'Relationship unclear. Manually verify if changes to one require changes to the other.',
};

// Universal ignore patterns covering multiple languages and ecosystems
export const UNIVERSAL_IGNORE_PATTERNS = [
	// JavaScript/Node.js
	"node_modules/", "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "npm-debug.log",
	"dist/", "build/", ".next/", ".nuxt/", ".cache/", "coverage/",

	// Python
	"__pycache__/", "*.pyc", "*.pyo", "*.pyd", ".Python", "venv/", ".venv/", "env/",
	"pip-log.txt", ".pytest_cache/", ".mypy_cache/", "*.egg-info/", ".tox/",

	// Java/Kotlin
	"target/", "*.class", "*.jar", "*.war", ".gradle/", "build/", ".mvn/",

	// C/C++
	"*.o", "*.obj", "*.exe", "*.dll", "*.so", "*.dylib", "*.a", "*.lib",

	// Rust
	"target/", "Cargo.lock",

	// Go
	"vendor/", "*.test", "*.out",

	// Ruby
	"Gemfile.lock", ".bundle/", "vendor/bundle/",

	// PHP
	"vendor/", "composer.lock",

	// .NET
	"bin/", "obj/", "*.dll", "*.exe", "*.pdb",

	// Build outputs (general)
	"out/", "output/", "release/", "debug/",

	// IDE/Editor files
	".vscode/", ".idea/", "*.swp", "*.swo", "*~", ".DS_Store", "Thumbs.db",

	// VCS
	".git/", ".svn/", ".hg/",

	// Logs
	"*.log", "logs/",
];

// --- PROJECT METRICS & ADAPTIVE THRESHOLDS ---

export interface ProjectMetrics {
	totalCommits: number;
	commitsPerWeek: number;
	avgFilesPerCommit: number;
}

export interface AdaptiveThresholds {
	couplingThreshold: number;  // Minimum % to consider files coupled
	driftDays: number;          // Days before a coupled file is "stale"
	analysisWindow: number;     // Number of commits to analyze
}

// Get project velocity metrics (cached)
export async function getProjectMetrics(repoRoot: string): Promise<ProjectMetrics> {
	const cacheKey = `project-metrics:${repoRoot}`;
	if (cache.has(cacheKey)) return cache.get(cacheKey);

	try {
		const git = simpleGit(repoRoot);

		// Get commits from last 30 days
		const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
		const log = await git.log({ '--since': thirtyDaysAgo, maxCount: 500 });

		const totalCommits = log.total;
		const commitsPerWeek = (totalCommits / 30) * 7;

		// Sample up to 10 commits to estimate files per commit
		let totalFiles = 0;
		const sampleCommits = log.all.slice(0, 10);
		for (const commit of sampleCommits) {
			try {
				const show = await git.show([commit.hash, '--name-only', '--format=']);
				totalFiles += show.split('\n').filter(f => f.trim()).length;
			} catch {
				// Skip commits that can't be read
			}
		}
		const avgFilesPerCommit = sampleCommits.length > 0 ? totalFiles / sampleCommits.length : 3;

		const metrics: ProjectMetrics = { totalCommits, commitsPerWeek, avgFilesPerCommit };
		cache.set(cacheKey, metrics);
		return metrics;
	} catch {
		// Return default metrics on error
		return { totalCommits: 0, commitsPerWeek: 10, avgFilesPerCommit: 3 };
	}
}

// Calculate thresholds based on project velocity and config overrides
export function getAdaptiveThresholds(metrics: ProjectMetrics, config?: MemoriaConfig | null): AdaptiveThresholds {
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
export function classifyChangeType(additions: string[], removals: string[]): ChangeType {
	const all = [...additions, ...removals].join('\n');

	// Schema/Type changes (interfaces, types, classes, field definitions)
	if (/\b(interface|type|schema|class|struct|enum)\b/.test(all) ||
		/:\s*(string|number|boolean|Date|any|null|undefined)\b/.test(all) ||
		/\b(extends|implements)\b/.test(all)) {
		return 'schema';
	}

	// API/Function signature changes
	if (/\b(function|async|export\s+(const|function|class)|def\s+\w+|func\s+\w+)\b/.test(all) ||
		/\b(return|throw|await|yield)\b/.test(all) ||
		/=>\s*[{\(]/.test(all)) {
		return 'api';
	}

	// Import/Export changes
	if (/^(import|export\s+\*|from\s+['"]|require\s*\()/m.test(all)) {
		return 'import';
	}

	// Config changes
	if (/\b(config|env|setting|option|constant|CONFIG|ENV)\b/i.test(all) ||
		/^[A-Z][A-Z_0-9]+\s*[:=]/.test(all) ||
		/\.(json|yaml|yml|toml|ini|env)/.test(all)) {
		return 'config';
	}

	// Test changes
	if (/\b(describe|it|test|expect|mock|jest|vitest|pytest|spec)\b/.test(all) ||
		/\.(test|spec)\.(ts|js|tsx|jsx)/.test(all)) {
		return 'test';
	}

	// Style changes (pure formatting - additions equal removals with only whitespace diff)
	if (additions.length === removals.length && additions.length > 0) {
		const isStyleOnly = additions.every((a, i) => {
			const removal = removals[i];
			return removal && a.replace(/\s/g, '') === removal.replace(/\s/g, '');
		});
		if (isStyleOnly) return 'style';
	}

	return 'unknown';
}

// Parse raw git diff into structured summary
export function parseDiffToSummary(rawDiff: string): DiffSummary {
	const lines = rawDiff.split('\n');
	const additions: string[] = [];
	const removals: string[] = [];
	let hunks = 0;

	for (const line of lines) {
		// Count hunk headers (@@...@@)
		if (line.startsWith('@@')) {
			hunks++;
		}
		// Additions (skip the +++ header line)
		else if (line.startsWith('+') && !line.startsWith('+++')) {
			const content = line.slice(1).trim();
			if (content) additions.push(content);
		}
		// Removals (skip the --- header line)
		else if (line.startsWith('-') && !line.startsWith('---')) {
			const content = line.slice(1).trim();
			if (content) removals.push(content);
		}
	}

	// Detect breaking changes
	const breakingPatterns = [
		/\b(remove|delete|deprecate)\b/i,                    // Removal keywords
		/^-\s*(export|public|module\.exports)/,              // Removed exports
		/^-\s*(async\s+)?function\s+\w+/,                    // Removed functions
		/^-\s*(interface|type|class)\s+\w+/,                 // Removed type definitions
	];
	const hasBreakingChange = removals.some(r =>
		breakingPatterns.some(p => p.test('-' + r))
	);

	// Classify the relationship type
	const changeType = classifyChangeType(additions, removals);

	return {
		additions: additions.slice(0, 10),  // Limit to 10 most relevant
		removals: removals.slice(0, 10),
		hunks,
		netChange: additions.length - removals.length,
		hasBreakingChange,
		changeType,
	};
}

// Helper: Get a git instance for the specific file's directory
export function getGitForFile(filePath: string) {
	const dir = path.dirname(filePath);
	return simpleGit(dir);
}

// Helper: Get the actual code diff for a specific file at a specific commit
export async function getDiffSnippet(repoRoot: string, relativeFilePath: string, commitHash: string): Promise<string> {
	try {
		const git = simpleGit(repoRoot);
		// Get the DIFF (changes made) for that file in that commit
		// Using -- separator to properly handle file paths
		const diff = await git.show([commitHash, "--", relativeFilePath]);

		// Extract just the diff portion (skip commit metadata)
		const diffStart = diff.indexOf("diff --git");
		const cleanDiff = diffStart > -1 ? diff.slice(diffStart) : diff;

		// Truncate if too large (save tokens, but keep enough for context)
		const maxLength = 1000;
		if (cleanDiff.length > maxLength) {
			return cleanDiff.slice(0, maxLength) + "\n...(truncated)";
		}
		return cleanDiff;
	} catch (e) {
		// File might not exist in that commit, or other git errors
		return "";
	}
}

// Helper: Parse .gitignore and create ignore filter (with config patterns)
export async function getIgnoreFilter(repoRoot: string, config?: MemoriaConfig | null) {
	// Include config in cache key if patterns are specified
	const configPatterns = config?.ignore?.join(',') || '';
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
	} catch (e) {
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
export function shouldIgnoreFile(filePath: string, ig: ReturnType<typeof ignore>) {
	// Normalize path for cross-platform compatibility
	const normalizedPath = filePath.replace(/\\/g, "/");
	return ig.ignores(normalizedPath);
}

// --- ENGINE 1: ENTANGLEMENT (Enhanced with Context + Evidence + Adaptive Thresholds + Config) ---
export async function getCoupledFiles(filePath: string, config?: MemoriaConfig | null) {
	// Include config in cache key if relevant settings are specified
	const configKey = config ? JSON.stringify({
		t: config.thresholds,
		i: config.ignore?.length
	}) : '';
	const cacheKey = `coupling:${filePath}:${configKey}`;
	if (cache.has(cacheKey)) return cache.get(cacheKey);

	try {
		const git = getGitForFile(filePath);
		const root = await git.revparse(["--show-toplevel"]);
		const repoRoot = root.trim();

		// Get project metrics and adaptive thresholds (with config overrides)
		const metrics = await getProjectMetrics(repoRoot);
		const thresholds = getAdaptiveThresholds(metrics, config);

		// Load ignore filter (with config patterns)
		const ig = await getIgnoreFilter(repoRoot, config);

		// Use adaptive analysis window
		const log = await git.log({ file: filePath, maxCount: thresholds.analysisWindow });
		if (log.total === 0) return [];

		// Track both count AND the most recent commit info
		const couplingMap: Record<string, { count: number; lastHash: string; lastMsg: string }> = {};

		// Process all commits to find co-changes
		await Promise.all(
			log.all.map(async (commit) => {
				const show = await git.show([commit.hash, "--name-only", "--format="]);
				const files = show
					.split("\n")
					.map((f) => f.trim())
					.filter((f) => {
						if (!f) return false;
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
			})
		);

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
				const rawDiff = await getDiffSnippet(repoRoot, item.file, item.lastHash);
				const evidence = parseDiffToSummary(rawDiff);
				return {
					file: item.file,
					score: item.score,
					reason: item.reason,
					lastHash: item.lastHash,
					evidence,  // Now a structured DiffSummary instead of raw string
				};
			})
		);

		cache.set(cacheKey, result);
		return result;
	} catch (e) {
		return [];
	}
}

// --- ENGINE 2: DRIFT (Enhanced with Adaptive Thresholds + Config) ---
export async function checkDrift(sourceFile: string, coupledFiles: { file: string }[], config?: MemoriaConfig | null) {
	const alerts = [];
	try {
		const sourceStats = await fs.stat(sourceFile);
		const git = getGitForFile(sourceFile);
		const root = await git.revparse(["--show-toplevel"]);
		const repoRoot = root.trim();

		// Get adaptive drift threshold (with config overrides)
		const metrics = await getProjectMetrics(repoRoot);
		const thresholds = getAdaptiveThresholds(metrics, config);

		for (const { file } of coupledFiles) {
			try {
				// Git returns relative paths (e.g. src/utils.ts). We must resolve them.
				const siblingPath = path.join(repoRoot, file);

				const siblingStats = await fs.stat(siblingPath);
				const diffMs = sourceStats.mtimeMs - siblingStats.mtimeMs;
				const daysDiff = Math.floor(diffMs / (1000 * 60 * 60 * 24));

				// Use adaptive drift threshold instead of hardcoded 7 days
				if (daysDiff > thresholds.driftDays) {
					alerts.push({ file, daysOld: daysDiff });
				}
			} catch (e) {
				/* File deleted or moved */
			}
		}
	} catch (e) {
		/* Source new */
	}
	return alerts;
}

// --- ENGINE 3: STATIC IMPORTS (The Fallback Layer) ---
// Solves the "New File Problem" - files with no git history but many importers
export async function getImporters(filePath: string): Promise<string[]> {
	const cacheKey = `importers:${filePath}`;
	if (cache.has(cacheKey)) return cache.get(cacheKey);

	try {
		const git = getGitForFile(filePath);
		const root = await git.revparse(["--show-toplevel"]);
		const repoRoot = root.trim();

		// Get the filename without extension for import matching
		const fileName = path.basename(filePath, path.extname(filePath));
		const relativePath = path.relative(repoRoot, filePath);

		// Load ignore filter
		const ig = await getIgnoreFilter(repoRoot);

		// Use git grep to find files that import this file
		// This is extremely fast (~10ms) compared to parsing AST
		const grepResult = await git.raw(['grep', '-l', '--', fileName]).catch(() => '');

		// Parse results and filter
		const importers = grepResult
			.split('\n')
			.map(line => line.trim())
			.filter(f => {
				if (!f) return false;
				// Exclude the file itself (check both relative path and basename)
				if (f === relativePath) return false;
				if (path.basename(f) === path.basename(filePath)) return false;
				// Exclude ignored files
				if (shouldIgnoreFile(f, ig)) return false;
				return true;
			});

		// Deduplicate
		const result = [...new Set(importers)];
		cache.set(cacheKey, result);
		return result;
	} catch (e) {
		return [];
	}
}

// --- ENGINE 4: SIBLING GUIDANCE (Smart New File Guidance) ---
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
	config?: MemoriaConfig | null
): Promise<SiblingGuidance | null> {
	// Include config in cache key if custom keywords are specified (affects volatility calc)
	const configKey = config?.panicKeywords ? Object.keys(config.panicKeywords).join(',') : '';
	const cacheKey = `siblings:${filePath}:${configKey}`;
	if (cache.has(cacheKey)) return cache.get(cacheKey);

	try {
		const dir = path.dirname(filePath);
		const ext = path.extname(filePath);
		const fileName = path.basename(filePath, ext);

		// Read directory contents
		const dirContents = await fs.readdir(dir);

		// Find siblings with same extension (excluding the target file)
		const siblings = dirContents.filter(f => {
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

		// Check for test files
		const testSuffixes = ['.test', '.spec', '-test', '-spec', '_test', '_spec'];
		const siblingBases = siblings.map(s => path.basename(s, ext));
		const hasTestFiles = siblingBases.some(base =>
			testSuffixes.some(suffix => base.endsWith(suffix))
		);

		// Check if this file should have a test
		const isNotTestFile = !testSuffixes.some(suffix => fileName.endsWith(suffix));
		if (hasTestFiles && isNotTestFile) {
			const testExamples = siblingBases
				.filter(base => testSuffixes.some(suffix => base.endsWith(suffix)))
				.slice(0, 3);
			patterns.push({
				description: 'Test file expected - all siblings have matching test files',
				examples: testExamples.map(e => e + ext),
				confidence: Math.min(100, (testExamples.length / siblings.length) * 100 + 30),
			});
		}

		// Analyze sibling files for common patterns
		const siblingPaths = siblings.map(s => path.join(dir, s));

		await Promise.all(siblingPaths.slice(0, 5).map(async (siblingPath) => {
			try {
				// Get volatility for each sibling
				const vol = await getVolatility(siblingPath, config);
				if (vol.commitCount > 0) {
					totalPanicScore += vol.panicScore;
					volatilityCount++;
				}

				// Read first 30 lines to detect common imports
				const content = await fs.readFile(siblingPath, 'utf8');
				const lines = content.split('\n').slice(0, 30);

				// Extract imports/requires
				for (const line of lines) {
					// Match: import ... from '...', require('...'), from ... import
					const importMatch = line.match(/(?:import|require|from)\s*[(\[]?\s*['"]([^'"]+)['"]/);
					if (importMatch) {
						const importPath = importMatch[1];
						importCounts[importPath] = (importCounts[importPath] || 0) + 1;
					}
				}
			} catch {
				// File might not be readable
			}
		}));

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
		const dominantPrefix = Object.entries(prefixes).find(([, count]) => count >= 2);
		const dominantSuffix = Object.entries(suffixes).find(([, count]) => count >= 2);

		if (dominantPrefix || dominantSuffix) {
			const namingParts: string[] = [];
			if (dominantPrefix) namingParts.push(`prefix "${dominantPrefix[0]}"`);
			if (dominantSuffix) namingParts.push(`suffix "${dominantSuffix[0]}"`);
			patterns.push({
				description: `Naming convention detected - siblings use ${namingParts.join(' and ')}`,
				examples: siblingBases.slice(0, 3).map(b => b + ext),
				confidence: 70,
			});
		}

		const guidance: SiblingGuidance = {
			directory: path.basename(dir),
			siblingCount: siblings.length,
			patterns,
			averageVolatility: volatilityCount > 0 ? Math.round(totalPanicScore / volatilityCount) : 0,
			hasTests: hasTestFiles,
			commonImports,
		};

		cache.set(cacheKey, guidance);
		return guidance;
	} catch (e) {
		cache.set(cacheKey, null);
		return null;
	}
}

// Format sibling guidance for AI consumption
export function formatSiblingGuidance(guidance: SiblingGuidance): string {
	let output = `**📁 SIBLING PATTERNS**\n`;
	output += `> Analyzed ${guidance.siblingCount} similar files in \`${guidance.directory}/\`\n\n`;

	for (const pattern of guidance.patterns) {
		output += `- [ ] **${pattern.description}**\n`;
		if (pattern.examples.length > 0) {
			output += `  > Examples: ${pattern.examples.map(e => `\`${e}\``).join(', ')}\n`;
		}
	}

	output += `\n**Average Sibling Volatility:** ${guidance.averageVolatility}%`;
	if (guidance.averageVolatility < 25) {
		output += ` (stable folder)\n`;
	} else if (guidance.averageVolatility < 50) {
		output += ` (moderate activity)\n`;
	} else {
		output += ` (active/volatile folder)\n`;
	}

	return output;
}

// --- ENGINE 5: HISTORY SEARCH (The Archaeologist) ---
// Solves "Chesterton's Fence" - why was this code written this way?

export interface HistorySearchResult {
	hash: string;
	date: string;
	author: string;
	message: string;
	filesChanged: string[];
	matchType: 'message' | 'diff';
}

export interface HistorySearchOutput {
	query: string;
	path: string | null;
	results: HistorySearchResult[];
	totalFound: number;
}

export async function searchHistory(
	query: string,
	filePath?: string,
	searchType: 'message' | 'diff' | 'both' = 'both',
	limit: number = 20,
	startLine?: number,
	endLine?: number
): Promise<HistorySearchOutput> {
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

	// Cache key includes query, path, search type, AND line range
	const lineRangeKey = startLine !== undefined && endLine !== undefined
		? `:L${startLine}-${endLine}`
		: '';
	const cacheKey = `history:${query}:${filePath || 'all'}:${searchType}${lineRangeKey}`;
	if (cache.has(cacheKey)) return cache.get(cacheKey);

	const results: HistorySearchResult[] = [];
	const seenHashes = new Set<string>();

	// LINE-RANGE SEARCH (Sherlock Mode) - git log -L
	if (startLine !== undefined && endLine !== undefined && filePath) {
		try {
			const relativePath = path.relative(repoRoot, filePath);

			// Validate line numbers
			if (startLine < 1 || endLine < startLine) {
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
				'log',
				`-L`, `${startLine},${endLine}:${relativePath}`,
				'--format=%H|%ai|%an|%s',
				`-n`, String(limit)
			];

			const lineRangeOutput = await git.raw(lineRangeArgs).catch(() => '');

			// Parse the output - look for lines matching our format
			const formatLineRegex = /^([0-9a-f]{40})\|(.+?)\|(.+?)\|(.*)$/;

			for (const line of lineRangeOutput.split('\n')) {
				const match = line.match(formatLineRegex);
				if (match && !seenHashes.has(match[1])) {
					const [, hash, date, author, message] = match;
					seenHashes.add(hash);

					// Get files changed in this commit
					const filesChanged = await git.raw(['show', hash, '--name-only', '--format=']).catch(() => '');
					const files = filesChanged.split('\n').filter(f => f.trim());

					// Filter by query if provided (otherwise show all line-range commits)
					const matchesQuery = !query.trim() ||
						message.toLowerCase().includes(query.toLowerCase());

					if (matchesQuery) {
						results.push({
							hash: hash.slice(0, 7),
							date: date?.split(' ')[0] || '',
							author: author || 'unknown',
							message: message.trim(),
							filesChanged: files.slice(0, 5),
							matchType: 'diff', // Line-range is effectively a diff search
						});
					}
				}
			}

			// If line-range was requested, return results directly (don't fall through)
			const sortedResults = results
				.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
				.slice(0, limit);

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

	try {
		// Search commit messages (git log --grep)
		if (searchType === 'message' || searchType === 'both') {
			const messageArgs = ['log', '--grep', query, '-i', '--format=%H|%ai|%an|%s', `-n`, String(limit)];
			if (filePath) {
				messageArgs.push('--', path.relative(repoRoot, filePath));
			}
			const messageResults = await git.raw(messageArgs).catch(() => '');

			for (const line of messageResults.split('\n').filter(l => l.trim())) {
				const [hash, date, author, ...msgParts] = line.split('|');
				if (hash && !seenHashes.has(hash)) {
					seenHashes.add(hash);

					// Get files changed in this commit
					const filesChanged = await git.raw(['show', hash, '--name-only', '--format=']).catch(() => '');
					const files = filesChanged.split('\n').filter(f => f.trim());

					results.push({
						hash: hash.slice(0, 7),
						date: date?.split(' ')[0] || '',
						author: author || 'unknown',
						message: msgParts.join('|').trim(),
						filesChanged: files.slice(0, 5),
						matchType: 'message',
					});
				}
			}
		}

		// Search code changes (git log -S "pickaxe")
		if ((searchType === 'diff' || searchType === 'both') && results.length < limit) {
			const remaining = limit - results.length;
			const pickaxeArgs = ['log', '-S', query, '--format=%H|%ai|%an|%s', `-n`, String(remaining)];
			if (filePath) {
				pickaxeArgs.push('--', path.relative(repoRoot, filePath));
			}
			const pickaxeResults = await git.raw(pickaxeArgs).catch(() => '');

			for (const line of pickaxeResults.split('\n').filter(l => l.trim())) {
				const [hash, date, author, ...msgParts] = line.split('|');
				if (hash && !seenHashes.has(hash)) {
					seenHashes.add(hash);

					// Get files changed in this commit
					const filesChanged = await git.raw(['show', hash, '--name-only', '--format=']).catch(() => '');
					const files = filesChanged.split('\n').filter(f => f.trim());

					results.push({
						hash: hash.slice(0, 7),
						date: date?.split(' ')[0] || '',
						author: author || 'unknown',
						message: msgParts.join('|').trim(),
						filesChanged: files.slice(0, 5),
						matchType: 'diff',
					});
				}
			}
		}
	} catch {
		// Git operation failed
	}

	// Sort by date (most recent first) and limit
	const sortedResults = results
		.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
		.slice(0, limit);

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

	let report = `### 🔍 History Search: "${query}"`;
	if (searchPath) {
		report += ` in \`${path.basename(searchPath)}\``;
	}
	report += '\n\n';

	if (totalFound === 0) {
		report += `**No commits found** matching "${query}".\n\n`;
		report += `Try:\n`;
		report += `- Different keywords or variations\n`;
		report += `- Removing the file path to search entire repo\n`;
		report += `- Using \`searchType: "diff"\` to search code changes\n`;
		return report;
	}

	report += `**Found ${totalFound} relevant commits:**\n\n`;

	results.forEach((r, i) => {
		const matchIcon = r.matchType === 'message' ? '💬' : '📝';
		report += `**${i + 1}. [${r.hash}] ${r.date}** by @${r.author} ${matchIcon}\n`;
		report += `> "${r.message}"\n`;
		if (r.filesChanged.length > 0) {
			report += `> Files: ${r.filesChanged.map(f => `\`${f}\``).join(', ')}\n`;
		}
		report += '\n';
	});

	report += `---\n\n`;
	report += `**🛑 AI INSTRUCTION:**\n`;
	report += `Before removing or modifying code related to "${query}":\n`;

	// Extract unique files from results for checklist
	const relatedFiles = new Set<string>();
	results.forEach(r => r.filesChanged.forEach(f => relatedFiles.add(f)));
	const topFiles = [...relatedFiles].slice(0, 5);

	topFiles.forEach(f => {
		report += `- [ ] Review context in \`${f}\`\n`;
	});

	if (results.some(r => r.message.toLowerCase().includes('fix') || r.message.toLowerCase().includes('bug'))) {
		report += `- [ ] ⚠️ Bug fixes detected in history - verify the issue is no longer relevant\n`;
	}

	return report;
}

// --- ENGINE 4: VOLATILITY (Enhanced with Time Decay, Author Tracking + Config) ---
export async function getVolatility(filePath: string, config?: MemoriaConfig | null): Promise<VolatilityResult> {
	// Include config in cache key if custom keywords are specified
	const configKeys = config?.panicKeywords ? Object.keys(config.panicKeywords).join(',') : '';
	const cacheKey = `volatility:${filePath}:${configKeys}`;
	if (cache.has(cacheKey)) return cache.get(cacheKey);

	const git = getGitForFile(filePath);
	const log = await git.log({ file: filePath, maxCount: 20 });

	// Get effective panic keywords (base + config overrides)
	const panicKeywords = getEffectivePanicKeywords(config);

	let weightedPanicScore = 0;
	const maxPossibleScore = 20 * 3; // 20 commits × max weight of 3
	const panicCommits: string[] = [];

	// Track author contributions (Bus Factor)
	const authorMap: Map<string, {
		name: string;
		email: string;
		commits: number;
		firstCommit: Date;
		lastCommit: Date;
	}> = new Map();

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
		const daysAgo = Math.floor((Date.now() - commitDate.getTime()) / (1000 * 60 * 60 * 24));

		// Track decay stats
		totalDecay += decay;
		oldestDays = Math.max(oldestDays, daysAgo);
		if (daysAgo < newestDays) newestDays = daysAgo;

		if (commitWeight > 0) {
			// Apply decay to the weighted score (recency bias)
			weightedPanicScore += commitWeight * decay;
			// Track high-severity commits for output (regardless of decay)
			if (commitWeight >= 2) {
				panicCommits.push(c.message.split('\n')[0].slice(0, 60));
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
		.map(a => ({
			name: a.name,
			email: a.email,
			commits: a.commits,
			percentage: Math.round((a.commits / totalCommits) * 100),
			firstCommit: a.firstCommit.toISOString().split('T')[0],
			lastCommit: a.lastCommit.toISOString().split('T')[0],
		}))
		.sort((a, b) => b.commits - a.commits);

	// Identify top author (bus factor indicator)
	const topAuthor = authorDetails.length > 0 ? authorDetails[0] : null;

	const result: VolatilityResult = {
		commitCount: log.total,
		panicScore: Math.min(100, Math.round((weightedPanicScore / maxPossibleScore) * 100)),
		panicCommits: panicCommits.slice(0, 3), // Top 3 concerning commits
		lastCommitDate: log.latest?.date,
		authors: authorMap.size, // Backward compatible count
		authorDetails,
		topAuthor,
		recencyDecay: {
			oldestCommitDays: oldestDays,
			newestCommitDays: newestDays === Infinity ? 0 : newestDays,
			decayFactor: log.total > 0 ? Math.round((totalDecay / log.total) * 100) / 100 : 1,
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
	config?: MemoriaConfig | null
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
	const couplingScores = coupled.slice(0, 3).map(c => c.score);
	const couplingComponent = couplingScores.length > 0
		? Math.min(100, (couplingScores.reduce((a, b) => a + b, 0) / couplingScores.length) * 1.5)
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
		importerComponent * IMPORTER_WEIGHT
	);

	// Collect risk factors
	const factors: string[] = [];
	if (volatilityComponent > 30) factors.push(`High volatility (${volatilityComponent}% panic score)`);
	if (coupled.length >= 3) factors.push(`Tightly coupled (${coupled.length} files)`);
	if (drift.length > 0) factors.push(`${drift.length} stale dependencies`);
	if (importers.length >= 5) factors.push(`Heavily imported (${importers.length} files depend on this)`);
	if (volatility.commitCount === 0) factors.push('No git history (new file)');

	// Determine level and action
	let level: RiskAssessment['level'];
	let action: string;

	if (score >= 75) {
		level = 'critical';
		action = 'STOP. Review all coupled files before any changes. Run tests after every edit.';
	} else if (score >= 50) {
		level = 'high';
		action = 'Proceed carefully. Check all coupled files and update stale dependencies.';
	} else if (score >= 25) {
		level = 'medium';
		action = 'Standard caution. Verify coupled files are still compatible.';
	} else {
		level = 'low';
		action = 'Safe to proceed with normal development practices.';
	}

	return { score, level, factors, action };
}

// --- OUTPUT FORMATTER (Enhanced with Structured Evidence + Compound Risk + Static Imports + Sibling Guidance) ---
export function generateAiInstructions(
	filePath: string,
	volatility: any,
	coupled: any[],
	drift: any[],
	importers: string[] = [],
	config?: MemoriaConfig | null,
	siblingGuidance?: SiblingGuidance | null
) {
	const fileName = path.basename(filePath);
	let instructions = `### 🧠 Forensics for \`${fileName}\`\n\n`;

	// Calculate compound risk score (now includes importer count and config weights)
	const risk = calculateCompoundRisk(volatility, coupled, drift, importers, config);

	// SECTION 1: COMPOUND RISK SCORE (The Summary)
	const riskEmoji = { low: '✅', medium: '⚠️', high: '🔥', critical: '🚨' }[risk.level];
	instructions += `**${riskEmoji} RISK: ${risk.score}/100 (${risk.level.toUpperCase()})**\n`;
	instructions += `> ${risk.action}\n\n`;

	if (risk.factors.length > 0) {
		instructions += `**Risk Factors:** ${risk.factors.join(' • ')}\n\n`;
	}

	instructions += `---\n\n`;

	// SECTION 2: COUPLED FILES WITH STRUCTURED EVIDENCE
	if (coupled.length > 0) {
		instructions += `**🔗 COUPLED FILES**\n\n`;

		coupled.forEach((c) => {
			const evidence: DiffSummary = c.evidence;
			const relationship = evidence?.changeType || 'unknown';
			const relationshipEmoji = {
				schema: '📐', api: '🔌', config: '⚙️', import: '📦',
				test: '🧪', style: '🎨', unknown: '❓'
			}[relationship];

			instructions += `**${relationshipEmoji} \`${c.file}\`** (${c.score}% coupled, ${relationship})\n`;
			instructions += `> ${RELATIONSHIP_INSTRUCTIONS[relationship]}\n`;

			// Show breaking change warning
			if (evidence?.hasBreakingChange) {
				instructions += `> ⚠️ **BREAKING CHANGE DETECTED** in last co-commit\n`;
			}

			// Compact diff summary (much more token-efficient than raw diff)
			if (evidence && (evidence.additions.length > 0 || evidence.removals.length > 0)) {
				if (evidence.additions.length > 0) {
					instructions += `> + ${evidence.additions.slice(0, 3).join(', ')}\n`;
				}
				if (evidence.removals.length > 0) {
					instructions += `> - ${evidence.removals.slice(0, 3).join(', ')}\n`;
				}
			}

			instructions += `\n`;
		});

		instructions += `---\n\n`;
	}

	// SECTION 3: STATIC DEPENDENTS (The Fallback Layer for New Files)
	if (importers.length > 0) {
		instructions += `**🧱 STATIC DEPENDENTS**\n\n`;
		instructions += `> These files explicitly import \`${fileName}\`. If you change the API, you MUST update them.\n\n`;

		// Show top 5 importers
		importers.slice(0, 5).forEach(file => {
			instructions += `- [ ] Check \`${file}\`\n`;
		});

		if (importers.length > 5) {
			instructions += `- ...and ${importers.length - 5} more files.\n`;
		}

		instructions += `\n---\n\n`;
	}

	// SECTION 4: PRE-FLIGHT CHECKLIST (The Action Plan)
	instructions += `**🛑 PRE-FLIGHT CHECKLIST**\n\n`;
	instructions += `- [ ] Modify \`${fileName}\` (primary target)\n`;

	coupled.forEach((c) => {
		const evidence: DiffSummary = c.evidence;
		const relationship = evidence?.changeType || 'unknown';
		instructions += `- [ ] Verify \`${c.file}\` (${relationship} coupling)\n`;
	});

	drift.forEach((d) => {
		instructions += `- [ ] Update \`${d.file}\` (stale by ${d.daysOld} days)\n`;
	});

	// Add importers to checklist if they exist and aren't already in coupled
	const coupledFiles = new Set(coupled.map(c => c.file));
	const newImporters = importers.filter(f => !coupledFiles.has(f));
	if (newImporters.length > 0) {
		newImporters.slice(0, 3).forEach(file => {
			instructions += `- [ ] Verify \`${file}\` (imports this file)\n`;
		});
		if (newImporters.length > 3) {
			instructions += `- ...and ${newImporters.length - 3} more importers to check.\n`;
		}
	}

	instructions += `\n---\n\n`;

	// SECTION 5: VOLATILITY DETAILS (with Bus Factor)
	instructions += `**📊 VOLATILITY**\n\n`;

	if (volatility.commitCount === 0) {
		instructions += `⚠️ **NEW FILE** - No git history available.\n\n`;

		// SECTION 6: SIBLING GUIDANCE (only for new files)
		if (siblingGuidance && siblingGuidance.patterns.length > 0) {
			instructions += `---\n\n`;
			instructions += formatSiblingGuidance(siblingGuidance);
		}
	} else {
		// Show status with recency context
		const statusLabel = volatility.panicScore > 50 ? 'VOLATILE'
			: volatility.panicScore > 25 ? 'Moderate'
			: 'Stable';
		instructions += `**🔥 Status:** ${statusLabel} (Score: ${volatility.panicScore}%)\n`;

		// Add recency context if available
		if (volatility.recencyDecay) {
			if (volatility.recencyDecay.newestCommitDays <= 14 && volatility.panicScore > 25) {
				instructions += `**Why:** High churn of bug fixes in the last ${volatility.recencyDecay.newestCommitDays} days.\n`;
			} else if (volatility.recencyDecay.oldestCommitDays > 90 && volatility.panicScore < 25) {
				const decayPercent = Math.round((1 - volatility.recencyDecay.decayFactor) * 100);
				instructions += `**Why:** Issues are from ${volatility.recencyDecay.oldestCommitDays}+ days ago (risk decayed by ${decayPercent}%).\n`;
			}
		}

		// Bus Factor Warning
		if (volatility.topAuthor && volatility.topAuthor.percentage >= 70) {
			instructions += `**Expert:** ${volatility.topAuthor.name} wrote ${volatility.topAuthor.percentage}% of this file. If the logic is unclear, assume it is complex.\n`;
		}

		instructions += `\n`;

		// Show concerning commits if any
		if (volatility.panicCommits && volatility.panicCommits.length > 0) {
			instructions += `**Concerning commits:**\n`;
			volatility.panicCommits.forEach((msg: string) => {
				instructions += `  - "${msg}"\n`;
			});
			instructions += `\n`;
		}

		// Contributors table (Bus Factor visibility)
		if (volatility.authorDetails && volatility.authorDetails.length > 0) {
			instructions += `**Contributors:**\n`;
			volatility.authorDetails.slice(0, 5).forEach((author: AuthorContribution) => {
				instructions += `  - ${author.name} (${author.commits} commits, ${author.percentage}%)\n`;
			});
			if (volatility.authorDetails.length > 5) {
				instructions += `  - ...and ${volatility.authorDetails.length - 5} more.\n`;
			}
			instructions += `\n`;
		}

		instructions += `**Last modified:** ${volatility.lastCommitDate}\n`;
	}

	return instructions;
}

// --- SERVER ---
const server = new Server({ name: "memoria", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
	tools: [
		{
			name: "analyze_file",
			description: "Returns forensic history, hidden dependencies, and risk assessment. USE THIS before modifying files.",
			inputSchema: {
				type: "object",
				properties: {
					path: {
						type: "string",
						description: "The ABSOLUTE path to the file (e.g. C:/dev/project/src/file.ts)",
					},
				},
				required: ["path"],
			},
		},
		{
			name: "ask_history",
			description: "Search git history for WHY code was written. Use when asking 'why does this exist?' or before removing code.",
			inputSchema: {
				type: "object",
				properties: {
					query: {
						type: "string",
						description: "Keyword to search for in commit messages and code changes (e.g. 'setTimeout', 'authentication', 'workaround')",
					},
					path: {
						type: "string",
						description: "Optional: ABSOLUTE path to scope search to a specific file or directory",
					},
					searchType: {
						type: "string",
						enum: ["message", "diff", "both"],
						description: "Where to search: 'message' (commit messages only), 'diff' (code changes only), 'both' (default)",
					},
					limit: {
						type: "number",
						description: "Maximum number of results to return (default: 20)",
					},
					startLine: {
						type: "number",
						description: "Start line for line-range search (requires path). Shows history of specific lines using git log -L.",
					},
					endLine: {
						type: "number",
						description: "End line for line-range search (requires path). Used with startLine to trace history of a code block.",
					},
				},
				required: ["query"],
			},
		},
	],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
	if (request.params.name === "analyze_file") {
		const rawPath = String(request.params.arguments?.path);

		// 1. Sanitize Path (Handle Windows/Unix differences)
		let targetPath = path.resolve(rawPath);

		// 2. Logic: If the resolved path doesn't exist, and the input was relative,
		// it means we resolved it against the Server's folder, not the Project folder.
		try {
			await fs.access(targetPath);
		} catch (e) {
			// If the file doesn't exist, FAIL LOUDLY so the AI retries
			return {
				content: [
					{
						type: "text",
						text: `❌ ERROR: File not found at \`${targetPath}\`.\n\n` +
							`The AI sent a relative path (\`${rawPath}\`), but this server runs globally.\n` +
							`**SYSTEM INSTRUCTION:** You MUST retry this tool call using the **ABSOLUTE PATH** (e.g. C:/dev/project/src/file.ts).`,
					},
				],
				isError: true,
			};
		}

		try {
			// 3. Load config from repo root (if exists)
			const git = getGitForFile(targetPath);
			const root = await git.revparse(["--show-toplevel"]);
			const repoRoot = root.trim();
			const config = await loadConfig(repoRoot);

			// 4. Run Engines on the Validated Path (all in parallel for speed)
			const [volatility, coupled, importers] = await Promise.all([
				getVolatility(targetPath, config),
				getCoupledFiles(targetPath, config),
				getImporters(targetPath),
			]);

			const drift = await checkDrift(targetPath, coupled, config);

			// 5. Get sibling guidance for new files (no git history)
			let siblingGuidance: SiblingGuidance | null = null;
			if (volatility.commitCount === 0) {
				siblingGuidance = await getSiblingGuidance(targetPath, config);
			}

			const report = generateAiInstructions(targetPath, volatility, coupled, drift, importers, config, siblingGuidance);

			return { content: [{ type: "text", text: report }] };
		} catch (error: any) {
			return {
				content: [{ type: "text", text: `Analysis Error: ${error.message}` }],
				isError: true,
			};
		}
	}

	if (request.params.name === "ask_history") {
		const query = String(request.params.arguments?.query || '');
		const rawPath = request.params.arguments?.path as string | undefined;
		const searchType = (request.params.arguments?.searchType as 'message' | 'diff' | 'both') || 'both';
		const limit = Number(request.params.arguments?.limit) || 20;
		const startLine = request.params.arguments?.startLine as number | undefined;
		const endLine = request.params.arguments?.endLine as number | undefined;

		if (!query.trim()) {
			return {
				content: [{
					type: "text",
					text: `❌ ERROR: Query is required.\n\n` +
						`**SYSTEM INSTRUCTION:** Provide a keyword to search for (e.g., "setTimeout", "authentication", "fix race condition").`,
				}],
				isError: true,
			};
		}

		// Validate line-range parameters
		if ((startLine !== undefined || endLine !== undefined) && !rawPath) {
			return {
				content: [{
					type: "text",
					text: `❌ ERROR: Line-range search requires a file path.\n\n` +
						`**SYSTEM INSTRUCTION:** Provide both \`path\` and \`startLine\`/\`endLine\` for line-range search.`,
				}],
				isError: true,
			};
		}

		if (startLine !== undefined && endLine !== undefined && startLine > endLine) {
			return {
				content: [{
					type: "text",
					text: `❌ ERROR: Invalid line range (${startLine}-${endLine}).\n\n` +
						`**SYSTEM INSTRUCTION:** startLine must be <= endLine.`,
				}],
				isError: true,
			};
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
						content: [{
							type: "text",
							text: `❌ ERROR: Path not found at \`${targetPath}\`.\n\n` +
								`**SYSTEM INSTRUCTION:** Use an ABSOLUTE path or omit the path to search the entire repository.`,
						}],
						isError: true,
					};
				}
			}

			const results = await searchHistory(query, targetPath, searchType, limit, startLine, endLine);
			const report = formatHistoryResults(results);

			return { content: [{ type: "text", text: report }] };
		} catch (error: any) {
			return {
				content: [{ type: "text", text: `History Search Error: ${error.message}` }],
				isError: true,
			};
		}
	}

	throw new Error("Tool not found");
});

const transport = new StdioServerTransport();
await server.connect(transport);
