#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import simpleGit from "simple-git";
import fs from "fs/promises";
import { LRUCache } from "lru-cache";
import path from "path";
import ignore from "ignore";

// --- CONFIGURATION & CACHE ---
// Cache results for 5 minutes
export const cache = new LRUCache<string, any>({ max: 100, ttl: 1000 * 60 * 5 });

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

// Helper: Get a git instance for the specific file's directory
export function getGitForFile(filePath: string) {
	const dir = path.dirname(filePath);
	return simpleGit(dir);
}

// Helper: Get the actual code diff for a specific file at a specific commit
export async function getDiffSnippet(repoRoot: string, relativeFilePath: string, commitHash: string): Promise<string> {
	try {
		const git = simpleGit(repoRoot);
		// Get diff of that file in that commit (show the changes made)
		const diff = await git.show([`${commitHash}:${relativeFilePath}`]);

		// Truncate if too large (save tokens, but keep enough for context)
		const maxLength = 1000;
		if (diff.length > maxLength) {
			return diff.slice(0, maxLength) + "\n...(truncated)";
		}
		return diff;
	} catch (e) {
		// File might not exist in that commit, or other git errors
		return "";
	}
}

// Helper: Parse .gitignore and create ignore filter
export async function getIgnoreFilter(repoRoot: string) {
	const cacheKey = `gitignore:${repoRoot}`;
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

	cache.set(cacheKey, ig);
	return ig;
}

// Helper: Check if a file should be ignored
export function shouldIgnoreFile(filePath: string, ig: ReturnType<typeof ignore>) {
	// Normalize path for cross-platform compatibility
	const normalizedPath = filePath.replace(/\\/g, "/");
	return ig.ignores(normalizedPath);
}

// --- ENGINE 1: ENTANGLEMENT (Enhanced with Context + Evidence) ---
export async function getCoupledFiles(filePath: string) {
	const cacheKey = `coupling:${filePath}`;
	if (cache.has(cacheKey)) return cache.get(cacheKey);

	try {
		const git = getGitForFile(filePath);
		const root = await git.revparse(["--show-toplevel"]);
		const repoRoot = root.trim();

		// Load ignore filter (cached)
		const ig = await getIgnoreFilter(repoRoot);

		const log = await git.log({ file: filePath, maxCount: 50 });
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

		// Get top 5 coupled files
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
			.filter((x) => x.score > 15);

		// Fetch diff evidence for all coupled files (parallel processing)
		const result = await Promise.all(
			topCoupled.map(async (item) => {
				const evidence = await getDiffSnippet(repoRoot, item.file, item.lastHash);
				return {
					file: item.file,
					score: item.score,
					reason: item.reason,
					lastHash: item.lastHash,
					evidence,
				};
			})
		);

		cache.set(cacheKey, result);
		return result;
	} catch (e) {
		return [];
	}
}

// --- ENGINE 2: DRIFT ---
export async function checkDrift(sourceFile: string, coupledFiles: { file: string }[]) {
	const alerts = [];
	try {
		const sourceStats = await fs.stat(sourceFile);
		const git = getGitForFile(sourceFile);
		const root = await git.revparse(["--show-toplevel"]);

		for (const { file } of coupledFiles) {
			try {
				// Git returns relative paths (e.g. src/utils.ts). We must resolve them.
				const siblingPath = path.join(root.trim(), file);

				const siblingStats = await fs.stat(siblingPath);
				const diffMs = sourceStats.mtimeMs - siblingStats.mtimeMs;
				const daysDiff = Math.floor(diffMs / (1000 * 60 * 60 * 24));

				if (daysDiff > 7) {
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

// --- ENGINE 3: VOLATILITY ---
export async function getVolatility(filePath: string) {
	const cacheKey = `volatility:${filePath}`;
	if (cache.has(cacheKey)) return cache.get(cacheKey);

	const git = getGitForFile(filePath); // <--- DYNAMIC GIT INSTANCE
	const log = await git.log({ file: filePath, maxCount: 20 });
	const panicKeywords = ["fix", "bug", "revert", "urgent", "hotfix", "oops"];

	let panicCount = 0;
	log.all.forEach((c) => {
		if (panicKeywords.some((k) => c.message.toLowerCase().includes(k))) panicCount++;
	});

	const result = {
		commitCount: log.total,
		panicScore: Math.min(100, Math.round((panicCount / 20) * 100)),
		lastCommitDate: log.latest?.date,
		authors: [...new Set(log.all.map((c) => c.author_name))].length,
	};

	cache.set(cacheKey, result);
	return result;
}

// --- OUTPUT FORMATTER (Detective Work + Checklist Format) ---
export function generateAiInstructions(filePath: string, volatility: any, coupled: any[], drift: any[]) {
	const fileName = path.basename(filePath);
	let instructions = `### 🧠 Forensics for \`${fileName}\`\n\n`;

	// SECTION 1: DETECTIVE WORK REQUIRED (The Intelligence Layer)
	if (coupled.length > 0) {
		instructions += `**🕵️ DETECTIVE WORK REQUIRED**\n\n`;
		instructions += `The following files are coupled with \`${fileName}\`. Analyze the evidence to understand *why* they change together:\n\n`;

		coupled.forEach((c) => {
			instructions += `**File:** \`${c.file}\` (${c.score}% coupled)\n`;
			instructions += `**Linked via:** "${c.reason.split("\n")[0].trim()}"\n`;

			if (c.evidence && c.evidence.length > 0) {
				instructions += `**Evidence (commit ${c.lastHash.substring(0, 7)}):**\n`;
				instructions += "```\n" + c.evidence + "\n```\n";
				instructions += `> **System Instruction:** Analyze the code above. Determine the relationship (e.g., shared types, API contract, schema dependency). Apply that logic when modifying \`${fileName}\`.\n\n`;
			} else {
				instructions += `> **System Instruction:** These files historically change together. Verify if your changes to \`${fileName}\` require updates to \`${c.file}\`.\n\n`;
			}
		});

		instructions += `---\n\n`;
	}

	// SECTION 2: PRE-FLIGHT CHECKLIST (The Action Plan)
	instructions += `**🛑 PRE-FLIGHT CHECKLIST**\n\n`;
	instructions += `You MUST complete these steps before finalizing code changes:\n\n`;
	instructions += `- [ ] Modify \`${fileName}\` (primary target)\n`;

	coupled.forEach((c) => {
		instructions += `- [ ] Verify/update \`${c.file}\` (${c.score}% coupling detected)\n`;
	});

	drift.forEach((d) => {
		instructions += `- [ ] Update \`${d.file}\` (stale by ${d.daysOld} days)\n`;
	});

	instructions += `\n---\n\n`;

	// SECTION 3: RISK ASSESSMENT (The Context)
	instructions += `**📊 RISK ASSESSMENT**\n\n`;

	if (volatility.commitCount === 0) {
		instructions += `⚠️ **Status:** NEW/UNTRACKED FILE\n`;
		instructions += `> This file has no git history. Proceed with caution - no historical data available.\n\n`;
	} else if (volatility.panicScore > 25) {
		instructions += `🔥 **Status:** VOLATILE (${volatility.panicScore}% Panic Score)\n`;
		instructions += `> **Warning:** This file has ${volatility.panicScore}% panic commits (fix/bug/revert/urgent). Code is historically fragile.\n`;
		instructions += `> **Required Action:** Review your changes twice. Do not delete safety checks or validation logic.\n\n`;
	} else {
		instructions += `✅ **Status:** STABLE (${volatility.panicScore}% Panic Score)\n`;
		instructions += `> This file has a clean history. Standard coding practices apply.\n\n`;
	}

	// Add metadata
	if (volatility.commitCount > 0) {
		instructions += `**Metadata:**\n`;
		instructions += `- Total commits analyzed: ${volatility.commitCount}\n`;
		instructions += `- Unique contributors: ${volatility.authors}\n`;
		instructions += `- Last modified: ${volatility.lastCommitDate}\n`;
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
			// 3. Run Engines on the Validated Path
			const [volatility, coupled] = await Promise.all([getVolatility(targetPath), getCoupledFiles(targetPath)]);

			const drift = await checkDrift(targetPath, coupled);
			const report = generateAiInstructions(targetPath, volatility, coupled, drift);

			return { content: [{ type: "text", text: report }] };
		} catch (error: any) {
			return {
				content: [{ type: "text", text: `Analysis Error: ${error.message}` }],
				isError: true,
			};
		}
	}
	throw new Error("Tool not found");
});

const transport = new StdioServerTransport();
await server.connect(transport);
