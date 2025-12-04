import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import simpleGit from "simple-git";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";

const git = simpleGit();

// --- ENGINE 1: ENTANGLEMENT (The "X-Ray") ---
async function getCoupledFiles(filePath: string, limit = 5) {
	try {
		// 1. Get last 50 commit hashes that touched this file
		const log = await git.log({ file: filePath, maxCount: 50 });
		const hashes = log.all.map((c) => c.hash);

		if (hashes.length === 0) return [];

		// 2. For each hash, find ALL files changed
		const couplingMap: Record<string, number> = {};

		// Run in parallel chunks for speed
		await Promise.all(
			hashes.map(async (hash) => {
				const show = await git.show([hash, "--name-only", "--format="]);
				const files = show.split("\n").filter((f) => f.trim() && f.trim() !== filePath);
				files.forEach((f) => (couplingMap[f] = (couplingMap[f] || 0) + 1));
			})
		);

		// 3. Sort by frequency
		return Object.entries(couplingMap)
			.sort(([, a], [, b]) => b - a)
			.slice(0, limit)
			.map(([file, count]) => ({
				file,
				score: Math.round((count / hashes.length) * 100), // % correlation
			}));
	} catch (e) {
		return [];
	}
}

// --- ENGINE 2: DRIFT (The "Sentinel") ---
async function checkDrift(sourceFile: string, coupledFiles: { file: string }[]) {
	const alerts = [];
	try {
		const sourceStats = await fs.stat(sourceFile);

		for (const { file } of coupledFiles) {
			try {
				const siblingStats = await fs.stat(file);
				const diffMs = sourceStats.mtimeMs - siblingStats.mtimeMs;
				const daysDiff = Math.floor(diffMs / (1000 * 60 * 60 * 24));

				// If source is newer than sibling by > 7 days
				if (daysDiff > 7) {
					alerts.push({ file, daysOld: daysDiff });
				}
			} catch (e) {
				/* File might be deleted, ignore */
			}
		}
	} catch (e) {
		/* Source might not exist on disk yet */
	}
	return alerts;
}

// --- ENGINE 3: VOLATILITY (The "Panic Check") ---
async function getVolatility(filePath: string) {
	const log = await git.log({ file: filePath, maxCount: 20 });
	const panicKeywords = ["fix", "bug", "revert", "urgent", "broken", "oops"];

	let panicCount = 0;
	log.all.forEach((c) => {
		if (panicKeywords.some((k) => c.message.toLowerCase().includes(k))) panicCount++;
	});

	return {
		commitCount: log.total,
		panicScore: Math.min(100, Math.round((panicCount / 20) * 100)), // 0-100
		lastAuthor: log.latest?.author_name || "Unknown",
	};
}

// --- MCP SERVER SETUP ---
const server = new Server({ name: "repo-forensics", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
	tools: [
		{
			name: "analyze_file_context",
			description: "Scans a file's history to find hidden dependencies, risk levels, and stale tests.",
			inputSchema: {
				type: "object",
				properties: { path: { type: "string" } },
				required: ["path"],
			},
		},
	],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
	if (request.params.name === "analyze_file_context") {
		const filePath = String(request.params.arguments?.path);

		// Run Engines Parallel
		const [volatility, coupled] = await Promise.all([getVolatility(filePath), getCoupledFiles(filePath)]);
		const drift = await checkDrift(filePath, coupled);

		// Format Markdown Output
		let report = `### 🕵️ Forensic Report: \`${filePath}\`\n\n`;

		// Risk Section
		const riskEmoji = volatility.panicScore > 30 ? "🔴" : "🟢";
		report += `**Risk Level:** ${riskEmoji} ${volatility.panicScore}/100 (Panic Score)\n`;
		report += `*Last 20 commits contained ${Math.round(volatility.panicScore / 5)} panic-fixes.*\n\n`;

		// Coupling Section
		if (coupled.length > 0) {
			report += `**🔗 Coupled Files (Hidden Dependencies):**\n`;
			coupled.forEach((c) => {
				report += `- \`${c.file}\` (Changed together **${c.score}%** of the time)\n`;
			});
			report += "\n";
		}

		// Drift Section
		if (drift.length > 0) {
			report += `**⚠️ Drift Warnings (Stale Files):**\n`;
			drift.forEach((d) => {
				report += `- \`${d.file}\` is **${d.daysOld} days** older than source. Check if it needs updates.\n`;
			});
		}

		return { content: [{ type: "text", text: report }] };
	}
	throw new Error("Tool not found");
});

const transport = new StdioServerTransport();
await server.connect(transport);
