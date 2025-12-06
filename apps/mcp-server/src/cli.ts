#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as p from "@clack/prompts";
import chalk from "chalk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Markers to identify Memoria sections in existing files
const MEMORIA_START = "<!-- MEMORIA:START -->";
const MEMORIA_END = "<!-- MEMORIA:END -->";

// Rule file mappings: tool name -> { source path, destination path }
const RULES: Record<string, { src: string; dest: string; name: string }> = {
	cursor: {
		src: "cursor/memoria.mdc",
		dest: ".cursor/rules/memoria.mdc",
		name: "Cursor",
	},
	claude: {
		src: "claude/CLAUDE.md",
		dest: ".claude/CLAUDE.md",
		name: "Claude Code",
	},
	windsurf: {
		src: "windsurf/.windsurfrules",
		dest: ".windsurfrules",
		name: "Windsurf",
	},
	cline: {
		src: "cline/.clinerules",
		dest: ".clinerules",
		name: "Cline/Continue",
	},
};

// MCP config file locations
interface McpConfig {
	getPath: (cwd: string) => string;
	name: string;
	scope: "project" | "global";
	detect: (cwd: string) => boolean;
}

const MCP_CONFIGS: Record<string, McpConfig> = {
	cursor: {
		getPath: (cwd: string) => path.join(cwd, ".cursor", "mcp.json"),
		name: "Cursor",
		scope: "project",
		detect: (cwd: string) =>
			fs.existsSync(path.join(cwd, ".cursor")) ||
			fs.existsSync(path.join(cwd, ".cursorrules")),
	},
	"claude-desktop": {
		getPath: () =>
			process.platform === "win32"
				? path.join(
						process.env.APPDATA || "",
						"Claude",
						"claude_desktop_config.json",
					)
				: path.join(
						os.homedir(),
						"Library",
						"Application Support",
						"Claude",
						"claude_desktop_config.json",
					),
		name: "Claude Desktop",
		scope: "global",
		detect: () => {
			const configPath =
				process.platform === "win32"
					? path.join(
							process.env.APPDATA || "",
							"Claude",
							"claude_desktop_config.json",
						)
					: path.join(
							os.homedir(),
							"Library",
							"Application Support",
							"Claude",
							"claude_desktop_config.json",
						);
			return fs.existsSync(path.dirname(configPath));
		},
	},
	windsurf: {
		getPath: () =>
			path.join(os.homedir(), ".codeium", "windsurf", "mcp_config.json"),
		name: "Windsurf",
		scope: "global",
		detect: () =>
			fs.existsSync(path.join(os.homedir(), ".codeium", "windsurf")),
	},
};

// Memoria MCP server entry
const MEMORIA_MCP_ENTRY = {
	command: "npx",
	args: ["-y", "@byronwade/memoria"],
};

function printHelp() {
	console.log(`
${chalk.bold("Memoria")} - The Memory Your AI Lacks

${chalk.dim("Usage:")}
  memoria                        Interactive setup (recommended)
  memoria init [options]         Install AI tool rules in your project
  memoria serve                  Start MCP server

${chalk.bold.cyan("Analysis Commands:")}
  memoria analyze <file>         Full forensic analysis of a file
  memoria risk <file>            Show risk score breakdown
  memoria coupled <file>         Show files coupled to target
  memoria importers <file>       Show files that import target
  memoria history <query> [file] Search git history for context

${chalk.bold.cyan("Setup Commands:")}
  memoria init                   Install Memoria rules for AI tools
  memoria serve                  Start the MCP server

${chalk.dim("Init Options:")}
  --cursor     Install Cursor rules (.cursor/rules/memoria.mdc)
  --claude     Install Claude Code rules (.claude/CLAUDE.md)
  --windsurf   Install Windsurf rules (.windsurfrules)
  --cline      Install Cline/Continue rules (.clinerules)
  --all        Install all rule files
  --force      Update existing Memoria rules

${chalk.dim("Analysis Options:")}
  --json       Output as JSON (for scripting)
  --no-color   Disable colored output

${chalk.dim("History Search Options:")}
  --type=<t>         Search type: message, diff, or both (default)
  --limit=<n>        Max results to return (default: 20)
  --since=<date>     Only commits after date (e.g., "30days", "2024-01-01")
  --until=<date>     Only commits before date
  --author=<name>    Filter by author name or email
  --diff, -d         Include code snippets (auto for ≤5 results)
  --commit-type=<t>  Filter: bugfix,feature,refactor,docs,test,chore

${chalk.dim("Examples:")}
  memoria analyze src/index.ts                Full analysis with risk score
  memoria risk src/api/route.ts               Quick risk assessment
  memoria coupled src/auth.ts                 See what files change together
  memoria importers src/types.ts              Find all files importing this
  memoria history "setTimeout" src/           Why was setTimeout added?
  memoria history "fix" --type=message        Search commit messages only
  memoria history "bug" --since=30days        Bug fixes in last 30 days
  memoria history "API" --commit-type=bugfix  Only bug fix commits
  memoria history "auth" --author=dave --diff Show code changes by dave
`);
}

function detectTools(cwd: string): string[] {
	const detected: string[] = [];

	if (
		fs.existsSync(path.join(cwd, ".cursor")) ||
		fs.existsSync(path.join(cwd, ".cursorrules"))
	) {
		detected.push("cursor");
	}
	if (fs.existsSync(path.join(cwd, ".claude"))) {
		detected.push("claude");
	}

	return detected;
}

type InstallResult = "created" | "appended" | "updated" | "skipped";

function isMdcFile(filePath: string): boolean {
	return filePath.endsWith(".mdc");
}

function extractFrontmatter(content: string): [string | null, string] {
	if (!content.startsWith("---")) {
		return [null, content];
	}
	const endMatch = content.indexOf("\n---", 3);
	if (endMatch === -1) {
		return [null, content];
	}
	const frontmatter = content.slice(0, endMatch + 4);
	const rest = content.slice(endMatch + 4);
	return [frontmatter, rest];
}

function installRule(
	srcPath: string,
	destPath: string,
	force: boolean,
): InstallResult {
	const srcContent = fs.readFileSync(srcPath, "utf8");
	const isMdc = isMdcFile(destPath);

	let wrappedContent: string;
	if (isMdc) {
		const [frontmatter, body] = extractFrontmatter(srcContent);
		if (frontmatter) {
			wrappedContent = `${frontmatter}\n${MEMORIA_START}\n${body}\n${MEMORIA_END}\n`;
		} else {
			wrappedContent = `${MEMORIA_START}\n${srcContent}\n${MEMORIA_END}\n`;
		}
	} else {
		wrappedContent = `${MEMORIA_START}\n${srcContent}\n${MEMORIA_END}\n`;
	}

	const destDir = path.dirname(destPath);
	if (!fs.existsSync(destDir)) {
		fs.mkdirSync(destDir, { recursive: true });
	}

	if (!fs.existsSync(destPath)) {
		fs.writeFileSync(destPath, wrappedContent);
		return "created";
	}

	const existingContent = fs.readFileSync(destPath, "utf8");

	if (existingContent.includes(MEMORIA_START)) {
		if (force) {
			const updated = existingContent.replace(
				/<!-- MEMORIA:START -->[\s\S]*?<!-- MEMORIA:END -->\n?/,
				`${MEMORIA_START}\n${isMdc ? extractFrontmatter(srcContent)[1] : srcContent}\n${MEMORIA_END}\n`,
			);
			fs.writeFileSync(destPath, updated);
			return "updated";
		}
		return "skipped";
	}

	if (isMdc) {
		const [frontmatter, body] = extractFrontmatter(existingContent);
		if (frontmatter) {
			const memoriaSection = `\n${MEMORIA_START}\n${extractFrontmatter(srcContent)[1]}\n${MEMORIA_END}\n`;
			fs.writeFileSync(destPath, frontmatter + memoriaSection + body);
			return "appended";
		}
	}

	const separator = existingContent.endsWith("\n") ? "\n" : "\n\n";
	fs.writeFileSync(destPath, existingContent + separator + wrappedContent);
	return "appended";
}

interface RuleInstallSummary {
	created: string[];
	appended: string[];
	updated: string[];
	skipped: string[];
}

function installRulesQuiet(
	tools: string[],
	cwd: string,
	force: boolean,
): RuleInstallSummary {
	let rulesDir = path.join(__dirname, "../rules");

	if (!fs.existsSync(rulesDir)) {
		rulesDir = path.join(__dirname, "../../rules");
	}

	const results: RuleInstallSummary = {
		created: [],
		appended: [],
		updated: [],
		skipped: [],
	};

	if (!fs.existsSync(rulesDir)) {
		return results;
	}

	for (const tool of tools) {
		const rule = RULES[tool];
		if (!rule) continue;

		const srcPath = path.join(rulesDir, rule.src);
		const destPath = path.join(cwd, rule.dest);

		if (!fs.existsSync(srcPath)) continue;

		const result = installRule(srcPath, destPath, force);
		results[result].push(rule.dest);
	}

	return results;
}

function installRules(tools: string[], cwd: string, force: boolean): void {
	const results = installRulesQuiet(tools, cwd, force);

	for (const dest of results.created) {
		console.log(`  ✓ Created ${dest}`);
	}
	for (const dest of results.appended) {
		console.log(`  ✓ Appended to ${dest}`);
	}
	for (const dest of results.updated) {
		console.log(`  ✓ Updated ${dest}`);
	}
	for (const dest of results.skipped) {
		console.log(`  ⊘ Skipped ${dest} (already installed)`);
	}
}

type McpInstallResult = "created" | "added" | "exists" | "error";

function installMcpConfig(configKey: string, cwd: string): McpInstallResult {
	const config = MCP_CONFIGS[configKey];
	if (!config) return "error";

	const configPath = config.getPath(cwd);

	try {
		const configDir = path.dirname(configPath);
		if (!fs.existsSync(configDir)) {
			fs.mkdirSync(configDir, { recursive: true });
		}

		let existingConfig: Record<string, unknown> = {};
		if (fs.existsSync(configPath)) {
			const content = fs.readFileSync(configPath, "utf8");
			existingConfig = JSON.parse(content);
		}

		const mcpServers =
			(existingConfig.mcpServers as Record<string, unknown>) || {};
		if (mcpServers.memoria) {
			return "exists";
		}

		existingConfig.mcpServers = {
			...mcpServers,
			memoria: MEMORIA_MCP_ENTRY,
		};

		fs.writeFileSync(configPath, JSON.stringify(existingConfig, null, 2));

		return fs.existsSync(configPath) ? "added" : "created";
	} catch {
		return "error";
	}
}

interface McpInstallSummary {
	added: string[];
	exists: string[];
	error: string[];
}

function installMcpConfigsQuiet(
	tools: string[],
	cwd: string,
): McpInstallSummary {
	const results: McpInstallSummary = { added: [], exists: [], error: [] };

	for (const tool of tools) {
		// Map rule tool names to MCP config keys
		const mcpKey = tool === "claude" ? "claude-desktop" : tool;
		const config = MCP_CONFIGS[mcpKey];
		if (!config) continue;

		const result = installMcpConfig(mcpKey, cwd);
		const configPath = config.getPath(cwd);
		const displayPath =
			config.scope === "global" ? configPath : path.relative(cwd, configPath);

		if (result === "created" || result === "added") {
			results.added.push(displayPath);
		} else if (result === "exists") {
			results.exists.push(displayPath);
		} else {
			results.error.push(displayPath);
		}
	}

	return results;
}

function runServer(): void {
	const serverPath = path.join(__dirname, "index.js");
	const child = spawn(process.execPath, [serverPath], {
		stdio: "inherit",
		env: process.env,
	});

	child.on("error", (err) => {
		console.error("Failed to start MCP server:", err.message);
		process.exit(1);
	});

	child.on("exit", (code) => {
		process.exit(code ?? 0);
	});
}

// ============================================================================
// Analysis Commands - Same capabilities as MCP tools, for manual use
// ============================================================================

type CommitType = "bugfix" | "feature" | "refactor" | "docs" | "test" | "chore" | "unknown";

interface CliOptions {
	json?: boolean;
	noColor?: boolean;
	type?: "message" | "diff" | "both";
	limit?: number;
	// New history search options
	since?: string;
	until?: string;
	author?: string;
	diff?: boolean;
	commitTypes?: CommitType[];
}

function parseCliOptions(args: string[]): CliOptions {
	const options: CliOptions = {};
	for (const arg of args) {
		if (arg === "--json") options.json = true;
		if (arg === "--no-color") options.noColor = true;
		if (arg === "--type=message") options.type = "message";
		if (arg === "--type=diff") options.type = "diff";
		if (arg === "--type=both") options.type = "both";
		if (arg.startsWith("--limit=")) {
			options.limit = parseInt(arg.split("=")[1], 10);
		}
		// New history search options
		if (arg.startsWith("--since=")) {
			options.since = arg.split("=")[1];
		}
		if (arg.startsWith("--until=")) {
			options.until = arg.split("=")[1];
		}
		if (arg.startsWith("--author=")) {
			options.author = arg.split("=")[1];
		}
		if (arg === "--diff" || arg === "-d") {
			options.diff = true;
		}
		if (arg.startsWith("--commit-type=")) {
			const types = arg.split("=")[1].split(",") as CommitType[];
			options.commitTypes = types;
		}
	}
	return options;
}

function resolveFilePath(filePath: string): string {
	if (path.isAbsolute(filePath)) return filePath;
	return path.resolve(process.cwd(), filePath);
}

function getRiskColor(score: number): (text: string) => string {
	if (score >= 75) return chalk.red;
	if (score >= 50) return chalk.yellow;
	if (score >= 25) return chalk.cyan;
	return chalk.green;
}

function getRiskLabel(score: number): string {
	if (score >= 75) return "CRITICAL";
	if (score >= 50) return "HIGH";
	if (score >= 25) return "MEDIUM";
	return "LOW";
}

async function runAnalyze(filePath: string, options: CliOptions): Promise<void> {
	const absolutePath = resolveFilePath(filePath);

	if (!fs.existsSync(absolutePath)) {
		console.error(chalk.red(`Error: File not found: ${filePath}`));
		process.exit(1);
	}

	const startTime = Date.now();

	// Dynamically import the analysis functions
	const memoria = await import("./index.js");

	const ctx = await memoria.createAnalysisContext(absolutePath);

	// Run all analyses in parallel (same as MCP tool)
	const [
		volatility,
		coupledFiles,
		importers,
		siblingGuidance,
	] = await Promise.all([
		memoria.getVolatility(absolutePath, ctx),
		memoria.getCoupledFiles(absolutePath, ctx),
		memoria.getImporters(absolutePath, ctx),
		memoria.getSiblingGuidance(absolutePath),
	]);

	// checkDrift needs coupled files as input
	const driftFiles = await memoria.checkDrift(absolutePath, coupledFiles, ctx);

	const riskAssessment = memoria.calculateCompoundRisk(
		volatility,
		coupledFiles,
		driftFiles,
		importers,
	);

	const duration = Date.now() - startTime;

	if (options.json) {
		console.log(JSON.stringify({
			file: filePath,
			absolutePath,
			riskScore: riskAssessment.score,
			riskLevel: riskAssessment.level.toUpperCase(),
			volatility,
			coupledFiles,
			driftFiles,
			importers,
			siblingGuidance,
			analysisTime: `${duration}ms`,
		}, null, 2));
		return;
	}

	// Pretty print output
	const fileName = path.basename(filePath);
	const riskColor = getRiskColor(riskAssessment.score);

	console.log();
	console.log(chalk.bold(`Forensics for \`${fileName}\``));
	console.log();
	console.log(riskColor(`RISK: ${riskAssessment.score}/100 (${riskAssessment.level.toUpperCase()})`));

	// Risk factors summary
	const factors: string[] = [];
	if (volatility.panicScore > 30) factors.push(`High volatility (${volatility.panicScore}%)`);
	if (coupledFiles.length > 0) factors.push(`Coupled (${coupledFiles.length} files)`);
	if (importers.length > 0) factors.push(`${importers.length} dependents`);
	if (driftFiles.length > 0) factors.push(`${driftFiles.length} stale`);

	if (factors.length > 0) {
		console.log(chalk.dim(`Risk factors: ${factors.join(" • ")}`));
	}
	console.log();

	// Volatility details
	if (volatility.panicScore > 0 || volatility.commitCount > 0) {
		console.log(chalk.bold.cyan("VOLATILITY"));
		console.log(chalk.dim(`  Panic score: ${volatility.panicScore}% | Commits: ${volatility.commitCount}`));
		if (volatility.topAuthor) {
			const pct = volatility.authorDetails?.[0]?.percentage || 0;
			console.log(chalk.dim(`  Top author: ${volatility.topAuthor.name} (${pct}%)`));
		}
		console.log();
	}

	// Coupled files
	if (coupledFiles.length > 0) {
		console.log(chalk.bold.cyan("COUPLED FILES"));
		for (const cf of coupledFiles) {
			const sourceLabel = cf.source ? `[${cf.source}]` : "";
			console.log(chalk.blue(`  ${cf.file} — ${cf.score}% ${sourceLabel}`));
			if (cf.reason) {
				console.log(chalk.dim(`    ${cf.reason}`));
			}
		}
		console.log();
	}

	// Drift warnings
	if (driftFiles.length > 0) {
		console.log(chalk.bold.yellow("DRIFT WARNINGS"));
		for (const df of driftFiles) {
			console.log(chalk.yellow(`  ${df.file} — stale ${df.daysOld} days`));
		}
		console.log();
	}

	// Static importers
	if (importers.length > 0) {
		console.log(chalk.bold.cyan("STATIC DEPENDENTS"));
		for (const imp of importers.slice(0, 10)) {
			console.log(chalk.dim(`  - [ ] Check \`${imp}\``));
		}
		if (importers.length > 10) {
			console.log(chalk.dim(`  ... and ${importers.length - 10} more`));
		}
		console.log();
	}

	// Sibling guidance for new files
	if (siblingGuidance && volatility.commitCount === 0) {
		console.log(chalk.bold.magenta("NEW FILE GUIDANCE"));
		console.log(chalk.dim(memoria.formatSiblingGuidance(siblingGuidance)));
		console.log();
	}

	console.log(chalk.dim(`Analysis completed in ${duration}ms`));
}

async function runRisk(filePath: string, options: CliOptions): Promise<void> {
	const absolutePath = resolveFilePath(filePath);

	if (!fs.existsSync(absolutePath)) {
		console.error(chalk.red(`Error: File not found: ${filePath}`));
		process.exit(1);
	}

	const memoria = await import("./index.js");
	const ctx = await memoria.createAnalysisContext(absolutePath);

	const [volatility, coupledFiles, importers] = await Promise.all([
		memoria.getVolatility(absolutePath, ctx),
		memoria.getCoupledFiles(absolutePath, ctx),
		memoria.getImporters(absolutePath, ctx),
	]);

	const driftFiles = await memoria.checkDrift(absolutePath, coupledFiles, ctx);
	const riskAssessment = memoria.calculateCompoundRisk(volatility, coupledFiles, driftFiles, importers);
	const config = await memoria.loadConfig(absolutePath);
	const weights = memoria.getEffectiveRiskWeights(config);

	if (options.json) {
		console.log(JSON.stringify({
			file: filePath,
			riskScore: riskAssessment.score,
			riskLevel: riskAssessment.level.toUpperCase(),
			breakdown: {
				volatility: { score: volatility.panicScore, weight: weights.volatility },
				coupling: { count: coupledFiles.length, weight: weights.coupling },
				drift: { count: driftFiles.length, weight: weights.drift },
				importers: { count: importers.length, weight: weights.importers },
			},
		}, null, 2));
		return;
	}

	const riskColor = getRiskColor(riskAssessment.score);
	console.log();
	console.log(chalk.bold(`Risk Assessment: \`${path.basename(filePath)}\``));
	console.log();
	console.log(riskColor(`  ${riskAssessment.score}/100 ${riskAssessment.level.toUpperCase()}`));
	console.log();
	console.log(chalk.dim("Breakdown:"));
	console.log(`  Volatility:  ${volatility.panicScore.toString().padStart(3)}% × ${(weights.volatility * 100).toFixed(0)}% weight`);
	console.log(`  Coupling:    ${coupledFiles.length.toString().padStart(3)} files × ${(weights.coupling * 100).toFixed(0)}% weight`);
	console.log(`  Drift:       ${driftFiles.length.toString().padStart(3)} stale × ${(weights.drift * 100).toFixed(0)}% weight`);
	console.log(`  Importers:   ${importers.length.toString().padStart(3)} files × ${(weights.importers * 100).toFixed(0)}% weight`);
	console.log();
}

async function runCoupled(filePath: string, options: CliOptions): Promise<void> {
	const absolutePath = resolveFilePath(filePath);

	if (!fs.existsSync(absolutePath)) {
		console.error(chalk.red(`Error: File not found: ${filePath}`));
		process.exit(1);
	}

	const memoria = await import("./index.js");
	const ctx = await memoria.createAnalysisContext(absolutePath);
	const coupledFiles = await memoria.getCoupledFiles(absolutePath, ctx);

	if (options.json) {
		console.log(JSON.stringify({ file: filePath, coupledFiles }, null, 2));
		return;
	}

	console.log();
	console.log(chalk.bold(`Coupled Files for \`${path.basename(filePath)}\``));
	console.log();

	if (coupledFiles.length === 0) {
		console.log(chalk.dim("  No coupled files detected."));
		console.log(chalk.dim("  This file changes independently of others."));
	} else {
		for (const cf of coupledFiles) {
			const sourceLabel = cf.source ? chalk.cyan(`[${cf.source}]`) : "";
			const scoreColor = cf.score >= 50 ? chalk.yellow : chalk.green;
			console.log(`  ${scoreColor(`${cf.score}%`)} ${cf.file} ${sourceLabel}`);
			if (cf.reason) {
				console.log(chalk.dim(`      ${cf.reason}`));
			}
		}
	}
	console.log();
}

async function runImporters(filePath: string, options: CliOptions): Promise<void> {
	const absolutePath = resolveFilePath(filePath);

	if (!fs.existsSync(absolutePath)) {
		console.error(chalk.red(`Error: File not found: ${filePath}`));
		process.exit(1);
	}

	const memoria = await import("./index.js");
	const ctx = await memoria.createAnalysisContext(absolutePath);
	const importers = await memoria.getImporters(absolutePath, ctx);

	if (options.json) {
		console.log(JSON.stringify({ file: filePath, importers }, null, 2));
		return;
	}

	console.log();
	console.log(chalk.bold(`Files importing \`${path.basename(filePath)}\``));
	console.log();

	if (importers.length === 0) {
		console.log(chalk.dim("  No files import this file."));
	} else {
		for (const imp of importers) {
			console.log(`  ${imp}`);
		}
		console.log();
		console.log(chalk.dim(`Total: ${importers.length} files`));
	}
	console.log();
}

// Color map for commit types
function getCommitTypeColor(type: CommitType): (text: string) => string {
	switch (type) {
		case "bugfix": return chalk.red;
		case "feature": return chalk.green;
		case "refactor": return chalk.cyan;
		case "docs": return chalk.blue;
		case "test": return chalk.magenta;
		case "chore": return chalk.gray;
		default: return chalk.white;
	}
}

async function runHistory(query: string, filePath: string | undefined, options: CliOptions): Promise<void> {
	const absolutePath = filePath ? resolveFilePath(filePath) : undefined;

	if (absolutePath && !fs.existsSync(absolutePath)) {
		console.error(chalk.red(`Error: File not found: ${filePath}`));
		process.exit(1);
	}

	const memoria = await import("./index.js");
	const result = await memoria.searchHistory({
		query,
		filePath: absolutePath,
		searchType: options.type || "both",
		limit: options.limit || 20,
		since: options.since,
		until: options.until,
		author: options.author,
		includeDiff: options.diff,
		commitTypes: options.commitTypes,
	});

	if (options.json) {
		console.log(JSON.stringify(result, null, 2));
		return;
	}

	console.log();
	console.log(chalk.bold(`History Search: "${query}"${filePath ? ` in \`${filePath}\`` : ""}`));

	// Show active filters
	const filters: string[] = [];
	if (options.since) filters.push(`since: ${options.since}`);
	if (options.until) filters.push(`until: ${options.until}`);
	if (options.author) filters.push(`author: ${options.author}`);
	if (options.commitTypes?.length) filters.push(`types: ${options.commitTypes.join(",")}`);
	if (filters.length > 0) {
		console.log(chalk.dim(`Filters: ${filters.join(" | ")}`));
	}
	console.log();

	if (result.totalFound === 0) {
		console.log(chalk.dim("  No commits found matching your query."));
		console.log();
		return;
	}

	console.log(chalk.dim(`Found ${result.totalFound} commits:`));
	console.log();

	// Check for bug fixes using commitType
	const hasBugFixes = result.results.some((c: any) => c.commitType === "bugfix");

	for (const commit of result.results) {
		const commitType = (commit.commitType || "unknown") as CommitType;
		const typeColor = getCommitTypeColor(commitType);
		const typeLabel = typeColor(`[${commitType.toUpperCase()}]`);
		const matchIcon = commit.matchType === "message" ? "msg" : "diff";
		const dateStr = new Date(commit.date).toLocaleDateString();
		console.log(`${typeLabel} ${chalk.yellow(`[${commit.hash.slice(0, 7)}]`)} ${dateStr} ${chalk.cyan(`@${commit.author}`)} · ${matchIcon}`);
		console.log(`   ${commit.message}`);
		if (commit.filesChanged.length > 0) {
			console.log(chalk.dim(`   Files: ${commit.filesChanged.slice(0, 3).join(", ")}${commit.filesChanged.length > 3 ? ` +${commit.filesChanged.length - 3} more` : ""}`));
		}
		// Show diff snippet if available
		if (commit.diffSnippet) {
			const changeLabel = commit.changeType === "added" ? chalk.green("+") : commit.changeType === "removed" ? chalk.red("-") : chalk.yellow("±");
			console.log();
			console.log(chalk.dim(`   Code Change (${changeLabel}):`));
			// Indent and colorize diff snippet
			const snippetLines = commit.diffSnippet.split("\n").slice(0, 8);
			for (const line of snippetLines) {
				if (line.startsWith("+") && !line.startsWith("+++")) {
					console.log(chalk.green(`   ${line}`));
				} else if (line.startsWith("-") && !line.startsWith("---")) {
					console.log(chalk.red(`   ${line}`));
				} else {
					console.log(chalk.dim(`   ${line}`));
				}
			}
			if (commit.diffSnippet.split("\n").length > 8) {
				console.log(chalk.dim("   ..."));
			}
		}
		console.log();
	}

	if (hasBugFixes) {
		console.log(chalk.yellow.bold("WARNING: Bug fixes detected! Review commits before modifying this code."));
		console.log();
	}
}

async function showInteractiveSetup(cwd: string): Promise<void> {
	console.clear();

	p.intro("Memoria - The Memory Your AI Lacks");

	const detectedTools = detectTools(cwd);
	const defaultTools =
		detectedTools.length > 0 ? detectedTools : ["cursor", "claude"];

	// Show what we detected
	if (detectedTools.length > 0) {
		const toolNames = detectedTools
			.map((t) => RULES[t]?.name || t)
			.join(", ");
		p.log.info(`Detected: ${toolNames}`);
	} else {
		p.log.info("No tools detected, defaulting to Cursor + Claude");
	}

	// Show what will be installed
	const summary = defaultTools
		.map((tool) => {
			const name = RULES[tool]?.name || tool;
			return `• ${name}: MCP config + rules`;
		})
		.join("\n");
	p.note(summary, "Ready to install");

	// Ask: proceed or customize?
	const action = await p.select({
		message: "Proceed with installation?",
		options: [
			{ value: "install", label: "Yes, install all" },
			{ value: "customize", label: "Customize..." },
			{ value: "cancel", label: "Cancel" },
		],
	});

	if (p.isCancel(action) || action === "cancel") {
		p.cancel("Setup cancelled.");
		process.exit(0);
	}

	let tools = defaultTools;
	let installMcp = true;
	let installRulesFlag = true;

	if (action === "customize") {
		// Step 1: Pick tools
		const selectedTools = await p.multiselect({
			message: "Which AI tools do you use?",
			options: [
				{ value: "cursor", label: "Cursor" },
				{ value: "claude", label: "Claude" },
				{ value: "windsurf", label: "Windsurf" },
				{ value: "cline", label: "Cline" },
			],
			initialValues: defaultTools,
			required: true,
		});

		if (p.isCancel(selectedTools)) {
			p.cancel("Setup cancelled.");
			process.exit(0);
		}

		tools = selectedTools as string[];

		// Step 2: Pick what to install
		const actions = await p.multiselect({
			message: "What to install for each tool?",
			options: [
				{ value: "mcp", label: "MCP configs", hint: "lets AI call Memoria" },
				{
					value: "rules",
					label: "Rules",
					hint: "tells AI to always use Memoria",
				},
			],
			initialValues: ["mcp", "rules"],
			required: true,
		});

		if (p.isCancel(actions)) {
			p.cancel("Setup cancelled.");
			process.exit(0);
		}

		installMcp = (actions as string[]).includes("mcp");
		installRulesFlag = (actions as string[]).includes("rules");
	}

	// Do the installation
	const s = p.spinner();
	s.start("Installing...");

	const installResults: string[] = [];

	if (installMcp) {
		// Install MCP configs for selected tools
		for (const tool of tools) {
			const mcpKey = tool === "claude" ? "claude-desktop" : tool;
			const config = MCP_CONFIGS[mcpKey];
			if (!config) continue;

			const result = installMcpConfig(mcpKey, cwd);
			const configPath = config.getPath(cwd);
			const displayPath =
				config.scope === "global" ? configPath : path.relative(cwd, configPath);

			if (result === "added" || result === "created") {
				installResults.push(`Added MCP config to ${displayPath}`);
			} else if (result === "exists") {
				installResults.push(`MCP already in ${displayPath}`);
			}
		}
	}

	if (installRulesFlag) {
		const ruleResults = installRulesQuiet(tools, cwd, false);
		for (const file of ruleResults.created) {
			installResults.push(`Created ${file}`);
		}
		for (const file of ruleResults.appended) {
			installResults.push(`Appended to ${file}`);
		}
		for (const file of ruleResults.skipped) {
			installResults.push(`Skipped ${file} (already installed)`);
		}
	}

	s.stop("Done!");

	if (installResults.length > 0) {
		p.note(installResults.join("\n"), "Changes made");
	}

	p.outro(
		"Your AI will now check for hidden dependencies before editing files.",
	);
}

async function main() {
	const args = process.argv.slice(2);
	const cwd = process.cwd();
	const options = parseCliOptions(args);

	// No arguments - check if interactive terminal vs MCP client
	if (args.length === 0) {
		if (process.stdin.isTTY && process.stdout.isTTY) {
			await showInteractiveSetup(cwd);
			return;
		}
		runServer();
		return;
	}

	// Check for explicit server command
	if (args[0] === "serve" || args[0] === "server") {
		runServer();
		return;
	}

	// Check for help
	if (args.includes("--help") || args.includes("-h")) {
		printHelp();
		process.exit(0);
	}

	// ========== Analysis Commands ==========

	// memoria analyze <file>
	if (args[0] === "analyze") {
		const nonFlagArgs = args.slice(1).filter((a) => !a.startsWith("--"));
		const filePath = nonFlagArgs[0];
		if (!filePath) {
			console.error(chalk.red("Error: Please provide a file path"));
			console.log("Usage: memoria analyze <file>");
			process.exit(1);
		}
		await runAnalyze(filePath, options);
		return;
	}

	// memoria risk <file>
	if (args[0] === "risk") {
		const nonFlagArgs = args.slice(1).filter((a) => !a.startsWith("--"));
		const filePath = nonFlagArgs[0];
		if (!filePath) {
			console.error(chalk.red("Error: Please provide a file path"));
			console.log("Usage: memoria risk <file>");
			process.exit(1);
		}
		await runRisk(filePath, options);
		return;
	}

	// memoria coupled <file>
	if (args[0] === "coupled") {
		const nonFlagArgs = args.slice(1).filter((a) => !a.startsWith("--"));
		const filePath = nonFlagArgs[0];
		if (!filePath) {
			console.error(chalk.red("Error: Please provide a file path"));
			console.log("Usage: memoria coupled <file>");
			process.exit(1);
		}
		await runCoupled(filePath, options);
		return;
	}

	// memoria importers <file>
	if (args[0] === "importers") {
		const nonFlagArgs = args.slice(1).filter((a) => !a.startsWith("--"));
		const filePath = nonFlagArgs[0];
		if (!filePath) {
			console.error(chalk.red("Error: Please provide a file path"));
			console.log("Usage: memoria importers <file>");
			process.exit(1);
		}
		await runImporters(filePath, options);
		return;
	}

	// memoria history <query> [file]
	if (args[0] === "history") {
		const nonFlagArgs = args.slice(1).filter((a) => !a.startsWith("--"));
		const query = nonFlagArgs[0];
		const filePath = nonFlagArgs[1];

		if (!query) {
			console.error(chalk.red("Error: Please provide a search query"));
			console.log("Usage: memoria history <query> [file]");
			process.exit(1);
		}
		await runHistory(query, filePath, options);
		return;
	}

	// ========== Setup Commands ==========

	// Check for init command
	if (args[0] !== "init") {
		console.error(chalk.red(`Unknown command: ${args[0]}`));
		console.log('Run "memoria --help" for usage');
		process.exit(1);
	}

	// Parse flags
	const flags = args.slice(1).filter((a) => a.startsWith("--"));
	const force = flags.includes("--force");

	const toolFlags = flags.filter((f) => f !== "--force" && f !== "--all");
	let tools: string[] = [];

	if (flags.includes("--all")) {
		tools = Object.keys(RULES);
	} else if (toolFlags.length > 0) {
		tools = toolFlags.map((f) => f.slice(2));
	} else {
		tools = detectTools(cwd);
		if (tools.length === 0) {
			console.log("No AI tools detected. Use --all or specify tools.");
			process.exit(0);
		}
		console.log(
			`Detected: ${tools.map((t) => RULES[t]?.name || t).join(", ")}`,
		);
	}

	console.log("\nInstalling Memoria rules...\n");
	installRules(tools, cwd, force);
}

main().catch(console.error);
