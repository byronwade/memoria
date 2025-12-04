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
const cache = new LRUCache<string, any>({ max: 100, ttl: 1000 * 60 * 5 });

// Universal ignore patterns covering multiple languages and ecosystems
const UNIVERSAL_IGNORE_PATTERNS = [
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
function getGitForFile(filePath: string) {
	const dir = path.dirname(filePath);
	return simpleGit(dir);
}

// Helper: Parse .gitignore and create ignore filter
async function getIgnoreFilter(repoRoot: string) {
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
function shouldIgnoreFile(filePath: string, ig: ReturnType<typeof ignore>) {
	// Normalize path for cross-platform compatibility
	const normalizedPath = filePath.replace(/\\/g, "/");
	return ig.ignores(normalizedPath);
}

// --- ENGINE 1: ENTANGLEMENT ---
async function getCoupledFiles(filePath: string) {
	const cacheKey = `coupling:${filePath}`;
	if (cache.has(cacheKey)) return cache.get(cacheKey);

	try {
		const git = getGitForFile(filePath); // <--- DYNAMIC GIT INSTANCE
		const root = await git.revparse(["--show-toplevel"]);
		const repoRoot = root.trim();

		// Load ignore filter (cached)
		const ig = await getIgnoreFilter(repoRoot);

		const log = await git.log({ file: filePath, maxCount: 50 });
		const hashes = log.all.map((c) => c.hash);
		if (hashes.length === 0) return [];

		const couplingMap: Record<string, number> = {};

		await Promise.all(
			hashes.map(async (hash) => {
				const show = await git.show([hash, "--name-only", "--format="]);
				const files = show
					.split("\n")
					.map((f) => f.trim())
					.filter((f) => {
						if (!f) return false;
						if (f.includes(path.basename(filePath))) return false;
						// Use the ignore filter
						return !shouldIgnoreFile(f, ig);
					});
				files.forEach((f) => (couplingMap[f] = (couplingMap[f] || 0) + 1));
			})
		);

		const result = Object.entries(couplingMap)
			.sort(([, a], [, b]) => b - a)
			.slice(0, 5)
			.map(([file, count]) => ({
				file,
				score: Math.round((count / hashes.length) * 100),
			}))
			.filter((x) => x.score > 15);

		cache.set(cacheKey, result);
		return result;
	} catch (e) {
		return [];
	}
}

// --- ENGINE 2: DRIFT ---
async function checkDrift(sourceFile: string, coupledFiles: { file: string }[]) {
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
async function getVolatility(filePath: string) {
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

// --- OUTPUT FORMATTER ---
function generateAiInstructions(filePath: string, volatility: any, coupled: any[], drift: any[]) {
	let instructions = `### 🧠 Repo Context Analysis for \`${path.basename(filePath)}\`\n`;
	instructions += `*System Instruction: Use this data to guide your coding decisions.*\n\n`;

	if (volatility.panicScore > 25) {
		instructions += `🔴 **HIGH RISK FILE (${volatility.panicScore}% Panic Score)**\n`;
		instructions += `> **Instruction:** This file has a history of bugs/reverts. You MUST review your changes twice. Do not delete safety checks.\n\n`;
	} else {
		instructions += `🟢 **Stable File.** Standard coding practices apply.\n\n`;
	}

	if (coupled.length > 0) {
		instructions += `🔗 **Entangled Files (Action Required)**\n`;
		instructions += `> **Instruction:** These files usually change when \`${path.basename(filePath)}\` changes. Check them:\n`;
		coupled.forEach((c) => {
			instructions += `- \`${c.file}\` (Coupled ${c.score}%)\n`;
		});
		instructions += `\n`;
	}

	if (drift.length > 0) {
		instructions += `⚠️ **Stale Siblings Detected**\n`;
		instructions += `> **Instruction:** These related files are outdated (>7 days). Update them:\n`;
		drift.forEach((d) => {
			instructions += `- \`${d.file}\` (${d.daysOld} days old)\n`;
		});
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
