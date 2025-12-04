#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as p from "@clack/prompts";

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
Memoria - The Memory Your AI Lacks

Usage:
  memoria                   Interactive setup (recommended)
  memoria init [options]    Install AI tool rules in your project
  memoria serve             Start MCP server

Commands:
  (no args)  Interactive setup
  init       Install Memoria rules for AI tools
  serve      Start the MCP server

Init Options:
  --cursor     Install Cursor rules (.cursor/rules/memoria.mdc)
  --claude     Install Claude Code rules (.claude/CLAUDE.md)
  --windsurf   Install Windsurf rules (.windsurfrules)
  --cline      Install Cline/Continue rules (.clinerules)
  --all        Install all rule files
  --force      Update existing Memoria rules (default: skip if already installed)
  --help       Show this help message

Examples:
  memoria                   Interactive setup
  memoria init --cursor     Install only Cursor rules
  memoria init --all        Install all rule files
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

	// Check for init command
	if (args[0] !== "init") {
		console.error(`Unknown command: ${args[0]}`);
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
