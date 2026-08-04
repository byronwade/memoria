#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as p from "@clack/prompts";
import chalk from "chalk";

// Import shared auth utilities
import {
	getOrCreateDevice,
	getDeviceInfo,
	updateDeviceInfo,
	clearDeviceInfo,
	openBrowser,
	registerAndPollDevice,
	MEMORIA_WEB_URL,
	MEMORIA_API_URL,
	type DeviceInfo,
} from "./auth.js";

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

// MCP config file locations.
//
// Different tools store MCP servers in different files, scopes (project vs the
// user's home directory), and JSON shapes. Capturing those differences here in
// data keeps the install logic uniform and cross-platform.
interface McpTarget {
	name: string;
	scope: "project" | "global";
	// The JSON key the server map lives under. Most tools use "mcpServers";
	// VS Code's native MCP support uses "servers".
	serversKey: "mcpServers" | "servers";
	// Returns the absolute config path, or null when unsupported on this OS.
	getPath: (cwd: string) => string | null;
}

// Cross-platform location of the Claude Desktop config file.
function claudeDesktopConfigPath(): string | null {
	if (process.platform === "win32") {
		const appData = process.env.APPDATA;
		return appData
			? path.join(appData, "Claude", "claude_desktop_config.json")
			: null;
	}
	if (process.platform === "darwin") {
		return path.join(
			os.homedir(),
			"Library",
			"Application Support",
			"Claude",
			"claude_desktop_config.json",
		);
	}
	// Linux and other Unix-likes follow the XDG convention.
	const xdg = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
	return path.join(xdg, "Claude", "claude_desktop_config.json");
}

const MCP_TARGETS: Record<string, McpTarget> = {
	cursor: {
		name: "Cursor",
		scope: "project",
		serversKey: "mcpServers",
		getPath: (cwd) => path.join(cwd, ".cursor", "mcp.json"),
	},
	claude: {
		// Claude Code reads a project-level `.mcp.json` at the repo root. This is
		// far more reliable than editing the user's global Claude Desktop config,
		// and matches where the Claude rules (.claude/CLAUDE.md) are installed.
		name: "Claude Code",
		scope: "project",
		serversKey: "mcpServers",
		getPath: (cwd) => path.join(cwd, ".mcp.json"),
	},
	"claude-desktop": {
		name: "Claude Desktop",
		scope: "global",
		serversKey: "mcpServers",
		getPath: () => claudeDesktopConfigPath(),
	},
	windsurf: {
		name: "Windsurf",
		scope: "global",
		serversKey: "mcpServers",
		getPath: () =>
			path.join(os.homedir(), ".codeium", "windsurf", "mcp_config.json"),
	},
	vscode: {
		name: "VS Code",
		scope: "project",
		serversKey: "servers",
		getPath: (cwd) => path.join(cwd, ".vscode", "mcp.json"),
	},
};

// Maps a rule-tool selection to the MCP target it should configure.
// Tools without a standard MCP config file (e.g. Cline) are rules-only.
const TOOL_TO_MCP: Record<string, string> = {
	cursor: "cursor",
	claude: "claude",
	windsurf: "windsurf",
};

// Memoria MCP server entry written into each tool's config.
const MEMORIA_MCP_ENTRY = {
	command: "npx",
	args: ["-y", "@byronwade/memoria"],
};

// Read the package version from the bundled package.json (best-effort).
function getVersion(): string {
	const candidates = [
		path.join(__dirname, "../package.json"), // published: dist/ -> ../package.json
		path.join(__dirname, "../../package.json"),
	];
	for (const candidate of candidates) {
		try {
			const pkg = JSON.parse(fs.readFileSync(candidate, "utf8"));
			if (pkg?.name === "@byronwade/memoria" && pkg.version) {
				return pkg.version as string;
			}
		} catch {
			// Try the next candidate.
		}
	}
	return "unknown";
}

function printHelp() {
	console.log(`
${chalk.bold("Memoria")} ${chalk.dim(`v${getVersion()}`)} - The Memory Your AI Lacks

${chalk.dim("Usage:")}
  memoria                        Interactive setup (recommended)
  memoria <command> [options]
  memoria --help                 Show this help
  memoria --version              Print the installed version

${chalk.bold.cyan("Account Commands:")}
  memoria login                  Link this device to your Memoria account
  memoria logout                 Unlink this device from your account
  memoria status                 Show current device/account status

${chalk.bold.cyan("Analysis Commands:")}
  memoria analyze <file>         Forensic analysis of a file
  memoria risk <file>            Show risk score breakdown
  memoria coupled <file>         Show files coupled to target
  memoria importers <file>       Show files that import target
  memoria history <query> [file] Search git history for context
  memoria diff [base]            Analyze files changed since base (default HEAD~1)
  memoria pack                   Precompute workspace pack for hot files

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
  --no-mcp     Skip writing project MCP server configs

${chalk.dim("Analysis Options:")}
  --json       Output as JSON (for scripting)
  --no-color   Disable colored output
  --fast       Core engines only (volatility, git, importers, tests)
  --full       All engines (default for analyze)
  --symbol <s> Symbol-level coupling for an exported name
  --budget <ms> Soft time budget; skip expensive engines when exceeded
  --min-confidence <0-1>  Drop low-confidence heuristic couplings

${chalk.dim("History Search Options:")} ${chalk.dim("(accept --flag=value or --flag value)")}
  --type <t>         Search type: message, diff, or both (default)
  --limit <n>        Max results to return (default: 20)
  --since <date>     Only commits after date (e.g., "30days", "2024-01-01")
  --until <date>     Only commits before date
  --author <name>    Filter by author name or email
  --diff, -d         Include code snippets (auto for ≤5 results)
  --commit-type <t>  Filter: bugfix,feature,refactor,docs,test,chore

${chalk.dim("Examples:")}
  memoria login                               Link device to your account
  memoria analyze src/index.ts                Full analysis with risk score
  memoria analyze src/index.ts --fast         Budgeted core analysis
  memoria analyze src/utils.ts --symbol=foo   Who references symbol foo?
  memoria diff HEAD~1                         Analyze files in the last commit
  memoria pack                                Warm .memoria/pack.json
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

// Locate the bundled `rules/` directory. The CLI runs from `dist/cli.js`, but
// the layout differs between a published npm package and the monorepo source
// tree, so we probe several candidates and verify a known rule file exists.
function findRulesDir(): string | null {
	const candidates = [
		path.join(__dirname, "../rules"), // published package: dist/ -> ../rules
		path.join(__dirname, "../../rules"), // some bundlers nest one deeper
		path.join(__dirname, "rules"), // co-located fallback
	];
	for (const dir of candidates) {
		// A rules dir is only valid if it actually contains our source files.
		if (fs.existsSync(path.join(dir, "claude", "CLAUDE.md"))) {
			return dir;
		}
	}
	return null;
}

function installRulesQuiet(
	tools: string[],
	cwd: string,
	force: boolean,
): RuleInstallSummary {
	const rulesDir = findRulesDir();

	const results: RuleInstallSummary = {
		created: [],
		appended: [],
		updated: [],
		skipped: [],
	};

	if (!rulesDir) {
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
	if (!findRulesDir()) {
		console.error(
			chalk.red(
				"Error: Could not locate Memoria's bundled rule files.",
			),
		);
		console.error(
			chalk.dim(
				"This usually means the package wasn't installed correctly. Try reinstalling @byronwade/memoria.",
			),
		);
		process.exitCode = 1;
		return;
	}

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

	const total =
		results.created.length +
		results.appended.length +
		results.updated.length +
		results.skipped.length;
	if (total === 0) {
		console.log(chalk.dim("  No matching rule files for the selected tools."));
	}
}

type McpInstallResult = "added" | "exists" | "unsupported" | "error";

function installMcpConfig(targetKey: string, cwd: string): McpInstallResult {
	const target = MCP_TARGETS[targetKey];
	if (!target) return "error";

	const configPath = target.getPath(cwd);
	if (!configPath) return "unsupported";

	try {
		const configDir = path.dirname(configPath);
		if (!fs.existsSync(configDir)) {
			fs.mkdirSync(configDir, { recursive: true });
		}

		let existingConfig: Record<string, unknown> = {};
		if (fs.existsSync(configPath)) {
			const content = fs.readFileSync(configPath, "utf8").trim();
			// Tolerate empty files; reject malformed JSON loudly so we never
			// silently clobber a user's hand-written config.
			if (content) {
				existingConfig = JSON.parse(content);
			}
		}

		const servers =
			(existingConfig[target.serversKey] as Record<string, unknown>) || {};
		if (servers.memoria) {
			return "exists";
		}

		existingConfig[target.serversKey] = {
			...servers,
			memoria: MEMORIA_MCP_ENTRY,
		};

		fs.writeFileSync(
			configPath,
			`${JSON.stringify(existingConfig, null, 2)}\n`,
		);

		return "added";
	} catch {
		return "error";
	}
}

// Resolve the display path for an MCP target (relative for project scope,
// absolute for global scope so the user knows exactly which file changed).
function mcpDisplayPath(targetKey: string, cwd: string): string {
	const target = MCP_TARGETS[targetKey];
	const configPath = target?.getPath(cwd);
	if (!configPath) return targetKey;
	return target.scope === "global"
		? configPath
		: path.relative(cwd, configPath);
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
	// Budgeted / symbol analysis
	fast?: boolean;
	full?: boolean;
	symbol?: string;
	budgetMs?: number;
	minConfidence?: number;
}

// Raised by the parser for an invalid flag value; carries a user-facing message.
class CliError extends Error {}

const VALID_COMMIT_TYPES: CommitType[] = [
	"bugfix",
	"feature",
	"refactor",
	"docs",
	"test",
	"chore",
];

// Flags that consume a value, accepted as either `--flag=value` or `--flag value`.
const VALUE_FLAGS = new Set([
	"limit",
	"type",
	"since",
	"until",
	"author",
	"commit-type",
	"symbol",
	"budget",
	"min-confidence",
]);

// Boolean flags (no value).
const BOOL_FLAGS = new Set(["json", "no-color", "diff", "fast", "full"]);

interface ParsedArgs {
	command: string | undefined;
	positionals: string[];
	options: CliOptions;
	// Raw `--xxx` flags not consumed as analysis options (used by `init`).
	rawFlags: string[];
}

function applyOption(options: CliOptions, key: string, value: string): void {
	switch (key) {
		case "limit": {
			const n = Number(value);
			if (!Number.isInteger(n) || n <= 0) {
				throw new CliError(`--limit must be a positive integer (got "${value}")`);
			}
			options.limit = n;
			break;
		}
		case "type":
			if (value !== "message" && value !== "diff" && value !== "both") {
				throw new CliError(
					`--type must be one of: message, diff, both (got "${value}")`,
				);
			}
			options.type = value;
			break;
		case "since":
			options.since = value;
			break;
		case "until":
			options.until = value;
			break;
		case "author":
			options.author = value;
			break;
		case "commit-type": {
			const types = value
				.split(",")
				.map((t) => t.trim())
				.filter(Boolean);
			for (const t of types) {
				if (!VALID_COMMIT_TYPES.includes(t as CommitType)) {
					throw new CliError(
						`--commit-type values must be one of: ${VALID_COMMIT_TYPES.join(", ")} (got "${t}")`,
					);
				}
			}
			options.commitTypes = types as CommitType[];
			break;
		}
		case "symbol":
			options.symbol = value;
			break;
		case "budget": {
			const n = Number(value);
			if (!Number.isFinite(n) || n <= 0) {
				throw new CliError(`--budget must be a positive number of ms (got "${value}")`);
			}
			options.budgetMs = n;
			break;
		}
		case "min-confidence": {
			const n = Number(value);
			if (!Number.isFinite(n) || n < 0 || n > 1) {
				throw new CliError(`--min-confidence must be between 0 and 1 (got "${value}")`);
			}
			options.minConfidence = n;
			break;
		}
	}
}

// Single tokenizer for the whole CLI. Separates the command, positional
// arguments, recognized analysis options, and any remaining raw flags so each
// command can pull exactly what it needs without re-parsing argv.
function parseArgs(argv: string[]): ParsedArgs {
	const options: CliOptions = {};
	const positionals: string[] = [];
	const rawFlags: string[] = [];

	let command: string | undefined;
	if (argv.length > 0 && !argv[0].startsWith("-")) {
		command = argv[0];
	}
	const rest = command ? argv.slice(1) : argv;

	for (let i = 0; i < rest.length; i++) {
		const token = rest[i];

		// Short aliases.
		if (token === "-d") {
			options.diff = true;
			continue;
		}

		if (!token.startsWith("--")) {
			positionals.push(token);
			continue;
		}

		// Strip leading `--` and split an inline `=value`.
		const body = token.slice(2);
		const eq = body.indexOf("=");
		const key = eq === -1 ? body : body.slice(0, eq);
		const inlineValue = eq === -1 ? undefined : body.slice(eq + 1);

		if (BOOL_FLAGS.has(key)) {
			if (key === "no-color") options.noColor = true;
			else if (key === "json") options.json = true;
			else if (key === "diff") options.diff = true;
			else if (key === "fast") options.fast = true;
			else if (key === "full") options.full = true;
			continue;
		}

		if (VALUE_FLAGS.has(key)) {
			let value = inlineValue;
			if (value === undefined) {
				// Consume the next token as the value (`--limit 5` form).
				const next = rest[i + 1];
				if (next === undefined || next.startsWith("--")) {
					throw new CliError(`--${key} requires a value`);
				}
				value = next;
				i++;
			}
			applyOption(options, key, value);
			continue;
		}

		// Unrecognized flag: keep it for command-specific handling (e.g. init tools).
		rawFlags.push(token);
	}

	return { command, positionals, options, rawFlags };
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

// ----------------------------------------------------------------------------
// Shared helpers for the analysis commands
// ----------------------------------------------------------------------------

// Lazily import the engine module once and reuse it across commands.
type Engine = typeof import("./index.js");
let enginePromise: Promise<Engine> | null = null;
function loadEngine(): Promise<Engine> {
	if (!enginePromise) enginePromise = import("./index.js");
	return enginePromise;
}

// Print a red error and exit non-zero. Centralizes failure formatting.
function fail(message: string, usage?: string): never {
	console.error(chalk.red(`Error: ${message}`));
	if (usage) console.error(chalk.dim(usage));
	process.exit(1);
}

// Resolve a file argument and verify it exists, failing cleanly otherwise.
function requireExistingFile(filePath: string | undefined, usage: string): string {
	if (!filePath) {
		fail("Please provide a file path", usage);
	}
	const absolutePath = resolveFilePath(filePath);
	if (!fs.existsSync(absolutePath)) {
		fail(`File not found: ${filePath}`);
	}
	return absolutePath;
}

function isGitError(error: unknown): boolean {
	const msg = error instanceof Error ? error.message : String(error);
	return (
		msg.includes("not a git repository") ||
		msg.includes("Cannot find git root") ||
		(msg.includes("git") && msg.includes("fatal"))
	);
}

// Wrap an analysis command body with friendly git/error handling.
async function runWithErrorHandling(fn: () => Promise<void>): Promise<void> {
	try {
		await fn();
	} catch (error) {
		if (isGitError(error)) {
			console.error(chalk.red("Error: Not inside a git repository."));
			console.error(
				chalk.dim(
					"Memoria analyzes git history. Run this command from within a git repo.",
				),
			);
			process.exit(1);
		}
		const msg = error instanceof Error ? error.message : String(error);
		fail(msg);
	}
}

function analyzeOptsFromCli(options: CliOptions): {
	mode?: "fast" | "full";
	symbol?: string;
	budgetMs?: number;
	confidenceMin?: number;
} {
	return {
		mode: options.fast ? "fast" : options.full ? "full" : "full",
		symbol: options.symbol,
		budgetMs: options.budgetMs,
		confidenceMin: options.minConfidence,
	};
}

async function runAnalyze(filePath: string, options: CliOptions): Promise<void> {
	const absolutePath = requireExistingFile(filePath, "Usage: memoria analyze <file>");

	const startTime = Date.now();
	const memoria = await loadEngine();

	// Run the SAME orchestrator the MCP `analyze_file` tool uses, so terminal
	// output and AI output can never disagree.
	const analysis = await memoria.analyzeFile(absolutePath, null, analyzeOptsFromCli(options));
	const {
		volatility,
		coupled,
		drift: driftFiles,
		importers,
		siblingGuidance,
		risk: riskAssessment,
		mode,
		kind,
		enginesRun,
	} = analysis;

	const duration = Date.now() - startTime;

	if (options.json) {
		console.log(JSON.stringify({
			file: filePath,
			absolutePath,
			riskScore: riskAssessment.score,
			riskLevel: riskAssessment.level.toUpperCase(),
			riskFactors: riskAssessment.factors,
			volatility,
			coupledFiles: coupled,
			driftFiles,
			importers,
			siblingGuidance,
			mode,
			kind,
			enginesRun,
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

	if (riskAssessment.factors.length > 0) {
		console.log(chalk.dim(`Risk factors: ${riskAssessment.factors.join(" • ")}`));
	}
	if (mode || kind) {
		console.log(chalk.dim(`Mode: ${mode ?? "full"} | Kind: ${kind ?? "unknown"} | Engines: ${(enginesRun ?? []).length}`));
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
	if (coupled.length > 0) {
		console.log(chalk.bold.cyan("COUPLED FILES"));
		for (const cf of coupled) {
			const sourceLabel = cf.source && cf.source !== "git" ? chalk.cyan(` [${cf.source}]`) : "";
			const conf =
				typeof cf.confidence === "number" && cf.confidence < 0.7
					? chalk.dim(` ~${Math.round(cf.confidence * 100)}%`)
					: "";
			console.log(chalk.blue(`  ${cf.file} — ${cf.score}%`) + sourceLabel + conf);
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

async function runDiff(base: string | undefined, options: CliOptions): Promise<void> {
	const diffBase = base || "HEAD~1";
	const memoria = await loadEngine();
	const result = await memoria.analyzeDiff(process.cwd(), diffBase, {
		...analyzeOptsFromCli(options),
		mode: options.full ? "full" : "fast",
	});

	if (options.json) {
		console.log(JSON.stringify(result, null, 2));
		return;
	}

	console.log();
	console.log(chalk.bold(`Diff analysis vs ${diffBase}`));
	console.log(chalk.dim(`${result.files.length} files · ${result.elapsedMs}ms`));
	console.log();
	for (const f of result.files.slice(0, 20)) {
		const riskColor = getRiskColor(f.risk.score);
		console.log(
			riskColor(`${String(f.risk.score).padStart(3)} `) +
				chalk.blue(path.relative(process.cwd(), f.filePath)) +
				chalk.dim(` · ${f.coupled.length} coupled · ${f.importers.length} importers`),
		);
	}
	if (result.files.length > 20) {
		console.log(chalk.dim(`  ... and ${result.files.length - 20} more`));
	}
	console.log();
}

async function runPack(options: CliOptions): Promise<void> {
	const memoria = await loadEngine();
	const limit = options.limit ?? 40;
	console.log(chalk.dim(`Building workspace pack (hot files ≤ ${limit})…`));
	const pack = await memoria.buildWorkspacePack(process.cwd(), {
		limit,
		mode: options.full ? "full" : "fast",
	});
	if (options.json) {
		console.log(JSON.stringify(pack, null, 2));
		return;
	}
	console.log(
		chalk.green(
			`Packed ${Object.keys(pack.files).length} files → .memoria/pack.json (HEAD ${pack.headSha.slice(0, 7)})`,
		),
	);
}

async function runRisk(filePath: string, options: CliOptions): Promise<void> {
	const absolutePath = requireExistingFile(filePath, "Usage: memoria risk <file>");

	const memoria = await loadEngine();
	const analysis = await memoria.analyzeFile(absolutePath);
	const { volatility, coupled, drift: driftFiles, importers, risk: riskAssessment } = analysis;
	const weights = memoria.getEffectiveRiskWeights(analysis.config);

	if (options.json) {
		console.log(JSON.stringify({
			file: filePath,
			riskScore: riskAssessment.score,
			riskLevel: riskAssessment.level.toUpperCase(),
			breakdown: {
				volatility: { score: volatility.panicScore, weight: weights.volatility },
				coupling: { count: coupled.length, weight: weights.coupling },
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
	console.log(`  Coupling:    ${coupled.length.toString().padStart(3)} files × ${(weights.coupling * 100).toFixed(0)}% weight`);
	console.log(`  Drift:       ${driftFiles.length.toString().padStart(3)} stale × ${(weights.drift * 100).toFixed(0)}% weight`);
	console.log(`  Importers:   ${importers.length.toString().padStart(3)} files × ${(weights.importers * 100).toFixed(0)}% weight`);
	console.log();
}

async function runCoupled(filePath: string, options: CliOptions): Promise<void> {
	const absolutePath = requireExistingFile(filePath, "Usage: memoria coupled <file>");

	const memoria = await loadEngine();
	// Use the merged coupling from all engines — same data the AI tool sees.
	const { coupled } = await memoria.analyzeFile(absolutePath);

	if (options.json) {
		console.log(JSON.stringify({ file: filePath, coupledFiles: coupled }, null, 2));
		return;
	}

	console.log();
	console.log(chalk.bold(`Coupled Files for \`${path.basename(filePath)}\``));
	console.log();

	if (coupled.length === 0) {
		console.log(chalk.dim("  No coupled files detected."));
		console.log(chalk.dim("  This file changes independently of others."));
	} else {
		for (const cf of coupled) {
			const sourceLabel = cf.source && cf.source !== "git" ? chalk.cyan(` [${cf.source}]`) : "";
			const scoreColor = cf.score >= 50 ? chalk.yellow : chalk.green;
			console.log(`  ${scoreColor(`${cf.score}%`)} ${cf.file}${sourceLabel}`);
			if (cf.reason) {
				console.log(chalk.dim(`      ${cf.reason}`));
			}
		}
	}
	console.log();
}

async function runImporters(filePath: string, options: CliOptions): Promise<void> {
	const absolutePath = requireExistingFile(filePath, "Usage: memoria importers <file>");

	const memoria = await loadEngine();
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

// ============================================================================
// Account Commands - Login, Logout, Status
// ============================================================================

async function runLogin(): Promise<void> {
	console.log();
	console.log(chalk.bold("Memoria Device Linking"));
	console.log();

	// Check if already linked
	const existingDevice = getDeviceInfo();
	if (existingDevice?.linkedAt && existingDevice?.userEmail) {
		console.log(chalk.green(`Already linked to ${existingDevice.userEmail}`));
		console.log(chalk.dim(`Device ID: ${existingDevice.deviceId.substring(0, 8)}...`));
		console.log();

		const relink = await p.confirm({
			message: "Do you want to re-link to a different account?",
			initialValue: false,
		});

		if (p.isCancel(relink) || !relink) {
			console.log(chalk.dim("Keeping existing connection."));
			return;
		}
	}

	// Get or create device
	const device = getOrCreateDevice();
	console.log(chalk.dim(`Device ID: ${device.deviceId.substring(0, 8)}...`));
	console.log();

	// Build the linking URL
	const linkUrl = `${MEMORIA_WEB_URL}/link?device=${device.deviceId}`;

	console.log(chalk.cyan("Opening browser for authentication..."));
	console.log();
	console.log(chalk.dim("If browser doesn't open, visit:"));
	console.log(chalk.underline(linkUrl));
	console.log();

	// Open browser
	openBrowser(linkUrl);

	// Start polling
	const s = p.spinner();
	s.start("Waiting for you to sign in...");

	const result = await registerAndPollDevice(device);

	if (result.linked) {
		s.stop(chalk.green(`Linked to ${result.email}`));
		console.log();
		console.log(chalk.green("Device linked successfully!"));
		console.log(chalk.dim("Your AI tools can now save memories to your account."));
	} else {
		s.stop(chalk.yellow("Linking timed out"));
		console.log();
		console.log(chalk.yellow("Device registration timed out."));
		console.log(chalk.dim("You can try again with: memoria login"));
	}
	console.log();
}

async function runLogout(): Promise<void> {
	console.log();

	const device = getDeviceInfo();
	if (!device?.linkedAt) {
		console.log(chalk.dim("No linked account found."));
		console.log();
		return;
	}

	const confirm = await p.confirm({
		message: `Unlink from ${device.userEmail || "your account"}?`,
		initialValue: false,
	});

	if (p.isCancel(confirm) || !confirm) {
		console.log(chalk.dim("Cancelled."));
		return;
	}

	// Remove linked info but keep device ID
	updateDeviceInfo({
		linkedAt: undefined,
		userId: undefined,
		userEmail: undefined,
	});

	// Notify server (best effort)
	try {
		await fetch(`${MEMORIA_API_URL}/devices/unlink`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ deviceId: device.deviceId }),
		});
	} catch {
		// Ignore - local unlink is sufficient
	}

	console.log(chalk.green("Device unlinked successfully."));
	console.log();
}

async function runStatus(): Promise<void> {
	console.log();
	console.log(chalk.bold("Memoria Status"));
	console.log();

	const device = getDeviceInfo();

	if (!device) {
		console.log(chalk.dim("No device configured."));
		console.log(chalk.dim("Run 'memoria login' to connect to your account."));
		console.log();
		return;
	}

	console.log(chalk.cyan("Device:"));
	console.log(`  ID:       ${device.deviceId.substring(0, 8)}...${device.deviceId.substring(device.deviceId.length - 4)}`);
	console.log(`  Hostname: ${device.hostname}`);
	console.log(`  Platform: ${device.platform}`);
	console.log(`  Created:  ${new Date(device.createdAt).toLocaleDateString()}`);
	console.log();

	if (device.linkedAt && device.userEmail) {
		console.log(chalk.green("Account: Connected"));
		console.log(`  Email:   ${device.userEmail}`);
		console.log(`  Linked:  ${new Date(device.linkedAt).toLocaleDateString()}`);

		// Check cloud status
		try {
			const statusUrl = `${MEMORIA_API_URL}/devices/status?deviceId=${device.deviceId}`;
			const response = await fetch(statusUrl, { signal: AbortSignal.timeout(5000) });

			if (response.ok) {
				const data = await response.json() as { status: string };
				if (data.status === "linked") {
					console.log(chalk.green("  Cloud:   Active"));
				} else if (data.status === "revoked") {
					console.log(chalk.red("  Cloud:   Revoked (run 'memoria login' to re-link)"));
				} else {
					console.log(chalk.yellow("  Cloud:   Pending"));
				}
			}
		} catch {
			console.log(chalk.dim("  Cloud:   Unable to verify (offline?)"));
		}
	} else {
		console.log(chalk.yellow("Account: Not connected"));
		console.log(chalk.dim("Run 'memoria login' to connect to your account."));
	}
	console.log();
}

async function runHistory(query: string, filePath: string | undefined, options: CliOptions): Promise<void> {
	let absolutePath: string | undefined;
	if (filePath) {
		absolutePath = resolveFilePath(filePath);
		if (!fs.existsSync(absolutePath)) {
			fail(`File not found: ${filePath}`);
		}
	}

	const memoria = await loadEngine();
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
			const mcpKey = TOOL_TO_MCP[tool];
			if (!mcpKey) continue;

			const result = installMcpConfig(mcpKey, cwd);
			const displayPath = mcpDisplayPath(mcpKey, cwd);

			if (result === "added") {
				installResults.push(`Added MCP config to ${displayPath}`);
			} else if (result === "exists") {
				installResults.push(`MCP already in ${displayPath}`);
			} else if (result === "error") {
				installResults.push(`Could not write MCP config for ${MCP_TARGETS[mcpKey].name}`);
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
	const argv = process.argv.slice(2);
	const cwd = process.cwd();

	// Global flags handled before command dispatch.
	if (argv.includes("--help") || argv.includes("-h")) {
		printHelp();
		process.exit(0);
	}
	if (argv.includes("--version") || argv.includes("-v") || argv[0] === "version") {
		console.log(getVersion());
		process.exit(0);
	}

	// No arguments - interactive terminal gets setup; otherwise act as MCP server.
	if (argv.length === 0) {
		if (process.stdin.isTTY && process.stdout.isTTY) {
			await showInteractiveSetup(cwd);
			return;
		}
		runServer();
		return;
	}

	// `serve`/`server` start the MCP server and never parse analysis flags.
	if (argv[0] === "serve" || argv[0] === "server") {
		runServer();
		return;
	}

	// Parse everything else through the unified tokenizer.
	let parsed: ParsedArgs;
	try {
		parsed = parseArgs(argv);
	} catch (error) {
		if (error instanceof CliError) {
			fail(error.message, 'Run "memoria --help" for usage');
		}
		throw error;
	}
	const { command, positionals, options, rawFlags } = parsed;

	// Honor --no-color by disabling chalk styling everywhere.
	if (options.noColor) chalk.level = 0;

	switch (command) {
		// ========== Account Commands ==========
		case "login":
			await runLogin();
			return;
		case "logout":
			await runLogout();
			return;
		case "status":
			await runStatus();
			return;

		// ========== Analysis Commands ==========
		case "analyze":
			await runWithErrorHandling(() => runAnalyze(positionals[0], options));
			return;
		case "risk":
			await runWithErrorHandling(() => runRisk(positionals[0], options));
			return;
		case "coupled":
			await runWithErrorHandling(() => runCoupled(positionals[0], options));
			return;
		case "importers":
			await runWithErrorHandling(() => runImporters(positionals[0], options));
			return;
		case "history": {
			const query = positionals[0];
			if (!query) {
				fail("Please provide a search query", "Usage: memoria history <query> [file]");
			}
			await runWithErrorHandling(() => runHistory(query, positionals[1], options));
			return;
		}
		case "diff":
			await runWithErrorHandling(() => runDiff(positionals[0], options));
			return;
		case "pack":
			await runWithErrorHandling(() => runPack(options));
			return;

		// ========== Setup Commands ==========
		case "init":
			runInit(cwd, rawFlags);
			return;

		default:
			fail(`Unknown command: ${command}`, 'Run "memoria --help" for usage');
	}
}

// `memoria init [--all|--cursor|--claude|...] [--force] [--no-mcp]`
function runInit(cwd: string, rawFlags: string[]): void {
	const force = rawFlags.includes("--force");
	const installMcp = !rawFlags.includes("--no-mcp");
	const reserved = new Set(["--force", "--all", "--mcp", "--no-mcp"]);
	const toolFlags = rawFlags.filter((f) => !reserved.has(f));

	let tools: string[];
	if (rawFlags.includes("--all")) {
		tools = Object.keys(RULES);
	} else if (toolFlags.length > 0) {
		// Validate tool flags up front so typos produce a clear message.
		const requested = toolFlags.map((f) => f.slice(2));
		const unknown = requested.filter((t) => !RULES[t]);
		tools = requested.filter((t) => RULES[t]);
		if (unknown.length > 0) {
			console.log(
				chalk.yellow(
					`Ignoring unknown tool${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}`,
				),
			);
			console.log(chalk.dim(`Valid tools: ${Object.keys(RULES).join(", ")}`));
		}
		if (tools.length === 0) {
			fail(
				"No valid tools specified.",
				`Valid tools: ${Object.keys(RULES).map((t) => `--${t}`).join(", ")}, or --all`,
			);
		}
	} else {
		tools = detectTools(cwd);
		if (tools.length === 0) {
			console.log("No AI tools detected. Use --all or specify tools.");
			console.log(
				chalk.dim(`Example: memoria init --all`),
			);
			process.exit(0);
		}
		console.log(
			`Detected: ${tools.map((t) => RULES[t]?.name || t).join(", ")}`,
		);
	}

	console.log("\nInstalling Memoria rules...\n");
	installRules(tools, cwd, force);

	if (installMcp) {
		installMcpForInit(tools, cwd);
	}
}

// Wire up MCP server configs during a non-interactive `init`. Rules tell the AI
// to use Memoria, but without an MCP config the AI literally cannot call it.
// We only auto-write PROJECT-scoped configs (safe, lives in the repo). For
// global configs (e.g. Windsurf in the home dir) we print the entry to add
// rather than silently editing files outside the project.
function installMcpForInit(tools: string[], cwd: string): void {
	console.log("\nConfiguring MCP servers...\n");
	let wroteAny = false;

	for (const tool of tools) {
		const mcpKey = TOOL_TO_MCP[tool];
		if (!mcpKey) continue;
		const target = MCP_TARGETS[mcpKey];

		if (target.scope === "global") {
			const displayPath = mcpDisplayPath(mcpKey, cwd);
			console.log(
				chalk.dim(
					`  ⓘ ${target.name} uses a global config (${displayPath}). Run 'memoria' (interactive) to set it up.`,
				),
			);
			continue;
		}

		const result = installMcpConfig(mcpKey, cwd);
		const displayPath = mcpDisplayPath(mcpKey, cwd);
		if (result === "added") {
			console.log(`  ✓ Configured ${target.name} (${displayPath})`);
			wroteAny = true;
		} else if (result === "exists") {
			console.log(`  ⊘ ${target.name} already configured (${displayPath})`);
			wroteAny = true;
		} else if (result === "error") {
			console.log(
				chalk.yellow(`  ✗ Could not write MCP config for ${target.name}`),
			);
		}
	}

	if (!wroteAny) {
		console.log(
			chalk.dim("  No project-scoped MCP configs for the selected tools."),
		);
	}
}

main().catch((error) => {
	console.error(chalk.red(error instanceof Error ? error.message : String(error)));
	process.exit(1);
});
