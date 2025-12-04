#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

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
			// Check if Claude Desktop directory exists
			return fs.existsSync(path.dirname(configPath));
		},
	},
	windsurf: {
		getPath: () =>
			path.join(os.homedir(), ".codeium", "windsurf", "mcp_config.json"),
		name: "Windsurf",
		scope: "global",
		detect: () => fs.existsSync(path.join(os.homedir(), ".codeium", "windsurf")),
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
  (no args)  Interactive setup with checkboxes
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

function detectMcpConfigs(cwd: string): string[] {
	const detected: string[] = [];

	for (const [key, config] of Object.entries(MCP_CONFIGS)) {
		if (config.detect(cwd)) {
			detected.push(key);
		}
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

function installRules(tools: string[], cwd: string, force: boolean): void {
	let rulesDir = path.join(__dirname, "../rules");

	if (!fs.existsSync(rulesDir)) {
		rulesDir = path.join(__dirname, "../../rules");
	}

	if (!fs.existsSync(rulesDir)) {
		console.error("Error: Could not find rules directory");
		process.exit(1);
	}

	const results: Record<InstallResult, string[]> = {
		created: [],
		appended: [],
		updated: [],
		skipped: [],
	};

	for (const tool of tools) {
		const rule = RULES[tool];
		if (!rule) continue;

		const srcPath = path.join(rulesDir, rule.src);
		const destPath = path.join(cwd, rule.dest);

		if (!fs.existsSync(srcPath)) continue;

		const result = installRule(srcPath, destPath, force);
		results[result].push(rule.dest);

		switch (result) {
			case "created":
				console.log(`  ✓ Created ${rule.dest}`);
				break;
			case "appended":
				console.log(`  ✓ Appended to ${rule.dest}`);
				break;
			case "updated":
				console.log(`  ✓ Updated ${rule.dest}`);
				break;
			case "skipped":
				console.log(`  ⊘ Skipped ${rule.dest} (already installed)`);
				break;
		}
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

		// Check if memoria is already configured
		const mcpServers =
			(existingConfig.mcpServers as Record<string, unknown>) || {};
		if (mcpServers.memoria) {
			return "exists";
		}

		// Add memoria to mcpServers
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

function installMcpConfigs(configKeys: string[], cwd: string): void {
	for (const key of configKeys) {
		const config = MCP_CONFIGS[key];
		if (!config) continue;

		const result = installMcpConfig(key, cwd);
		const configPath = config.getPath(cwd);
		const displayPath =
			config.scope === "global" ? configPath : path.relative(cwd, configPath);

		switch (result) {
			case "created":
			case "added":
				console.log(`  ✓ Added to ${displayPath}`);
				break;
			case "exists":
				console.log(`  ⊘ Already in ${displayPath}`);
				break;
			case "error":
				console.log(`  ✗ Failed: ${displayPath}`);
				break;
		}
	}
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

interface CheckboxOption {
	id: string;
	label: string;
	description: string;
	selected: boolean;
}

function showCheckboxMenu(
	cwd: string,
	options: CheckboxOption[],
	onComplete: (selected: string[]) => void,
): void {
	let currentIndex = 0;

	const render = () => {
		// Clear screen and move cursor to top
		process.stdout.write("\x1B[2J\x1B[H");

		console.log(`
┌─────────────────────────────────────────────────────────────┐
│  Memoria - The Memory Your AI Lacks                        │
└─────────────────────────────────────────────────────────────┘

  Use ↑/↓ to navigate, Space to toggle, Enter to confirm, q to quit
`);

		for (let i = 0; i < options.length; i++) {
			const opt = options[i];
			const checkbox = opt.selected ? "[x]" : "[ ]";
			const cursor = i === currentIndex ? ">" : " ";
			const highlight = i === currentIndex ? "\x1B[36m" : "\x1B[0m"; // Cyan for selected
			const reset = "\x1B[0m";

			console.log(`  ${cursor} ${highlight}${checkbox} ${opt.label}${reset}`);
			console.log(`      ${opt.description}`);
			console.log();
		}

		console.log("  ─────────────────────────────────────────────────────────");
		const selectedCount = options.filter((o) => o.selected).length;
		console.log(
			`\n  ${selectedCount} item(s) selected. Press Enter to install.\n`,
		);
	};

	// Enable raw mode for keyboard input
	if (process.stdin.isTTY) {
		process.stdin.setRawMode(true);
	}
	process.stdin.resume();

	render();

	process.stdin.on("data", (key: Buffer) => {
		const keyStr = key.toString();

		// q or Ctrl+C to quit
		if (keyStr === "q" || keyStr === "\x03") {
			process.stdout.write("\x1B[0m"); // Reset colors
			console.log("\n  Cancelled.\n");
			process.exit(0);
		}

		// Enter to confirm
		if (keyStr === "\r" || keyStr === "\n") {
			process.stdin.setRawMode(false);
			process.stdin.pause();
			process.stdout.write("\x1B[0m"); // Reset colors
			const selected = options.filter((o) => o.selected).map((o) => o.id);
			onComplete(selected);
			return;
		}

		// Space to toggle
		if (keyStr === " ") {
			options[currentIndex].selected = !options[currentIndex].selected;
			render();
			return;
		}

		// Arrow keys
		if (keyStr === "\x1B[A" || keyStr === "k") {
			// Up
			currentIndex = (currentIndex - 1 + options.length) % options.length;
			render();
		} else if (keyStr === "\x1B[B" || keyStr === "j") {
			// Down
			currentIndex = (currentIndex + 1) % options.length;
			render();
		}
	});
}

function showInteractiveMenu(cwd: string): void {
	const detectedTools = detectTools(cwd);
	const detectedMcpConfigs = detectMcpConfigs(cwd);

	// Build description strings
	const mcpConfigNames = detectedMcpConfigs
		.map((k) => MCP_CONFIGS[k]?.name)
		.filter(Boolean);
	const ruleToolNames = detectedTools
		.map((k) => RULES[k]?.name)
		.filter(Boolean);

	const mcpDescription =
		mcpConfigNames.length > 0
			? `Will add to: ${mcpConfigNames.join(", ")}`
			: "No MCP configs detected - will create for Cursor";

	const rulesDescription =
		ruleToolNames.length > 0
			? `Will install for: ${ruleToolNames.join(", ")}`
			: "Will install for all supported tools";

	const options: CheckboxOption[] = [
		{
			id: "mcp",
			label: "Install MCP server config",
			description: mcpDescription,
			selected: true,
		},
		{
			id: "rules",
			label: "Install AI tool rules",
			description: rulesDescription,
			selected: true,
		},
	];

	showCheckboxMenu(cwd, options, (selected) => {
		console.log("\n");

		if (selected.length === 0) {
			console.log("  Nothing selected. Goodbye!\n");
			process.exit(0);
		}

		if (selected.includes("mcp")) {
			console.log("  Installing MCP server configs...\n");
			const configs =
				detectedMcpConfigs.length > 0 ? detectedMcpConfigs : ["cursor"];
			installMcpConfigs(configs, cwd);
			console.log();
		}

		if (selected.includes("rules")) {
			console.log("  Installing AI tool rules...\n");
			const tools =
				detectedTools.length > 0 ? detectedTools : Object.keys(RULES);
			installRules(tools, cwd, false);
			console.log();
		}

		console.log("  ✓ Done! Memoria is ready to use.\n");
		console.log(
			"  Your AI will now check for hidden dependencies before editing files.\n",
		);
	});
}

function main() {
	const args = process.argv.slice(2);
	const cwd = process.cwd();

	// No arguments - check if interactive terminal vs MCP client
	if (args.length === 0) {
		if (process.stdin.isTTY && process.stdout.isTTY) {
			showInteractiveMenu(cwd);
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

main();
