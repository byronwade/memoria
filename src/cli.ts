#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
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

function printHelp() {
	console.log(`
Memoria - The Memory Your AI Lacks

Usage:
  memoria                   Start MCP server (for AI tool configs)
  memoria init [options]    Install AI tool rules in your project
  memoria serve             Explicitly start MCP server

Commands:
  init       Install Memoria rules for AI tools
  serve      Start the MCP server (same as running with no args)

Init Options:
  --cursor     Install Cursor rules (.cursor/rules/memoria.mdc)
  --claude     Install Claude Code rules (.claude/CLAUDE.md)
  --windsurf   Install Windsurf rules (.windsurfrules)
  --cline      Install Cline/Continue rules (.clinerules)
  --all        Install all rule files
  --force      Update existing Memoria rules (default: skip if already installed)
  --help       Show this help message

Behavior:
  - New files: Creates file with Memoria rules
  - Existing files without Memoria: Appends Memoria rules (preserves your content)
  - Existing files with Memoria: Skips (use --force to update)

Examples:
  memoria                   Run as MCP server (for npx -y @byronwade/memoria)
  memoria init              Auto-detect and install rules for detected tools
  memoria init --cursor     Install only Cursor rules
  memoria init --all        Install all rule files
`);
}

function detectTools(cwd: string): string[] {
	const detected: string[] = [];

	// Check for tool-specific directories/files
	if (
		fs.existsSync(path.join(cwd, ".cursor")) ||
		fs.existsSync(path.join(cwd, ".cursorrules"))
	) {
		detected.push("cursor");
	}
	if (fs.existsSync(path.join(cwd, ".claude"))) {
		detected.push("claude");
	}
	// Windsurf and Cline don't have clear detection markers, so we skip auto-detect for them

	return detected;
}

type InstallResult = "created" | "appended" | "updated" | "skipped";

// Check if file is an MDC file (Cursor format with YAML frontmatter)
function isMdcFile(filePath: string): boolean {
	return filePath.endsWith(".mdc");
}

// Extract YAML frontmatter from MDC file content
// Returns [frontmatter, rest] or [null, content] if no frontmatter
function extractFrontmatter(content: string): [string | null, string] {
	if (!content.startsWith("---")) {
		return [null, content];
	}
	const endMatch = content.indexOf("\n---", 3);
	if (endMatch === -1) {
		return [null, content];
	}
	const frontmatter = content.slice(0, endMatch + 4); // Include closing ---
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

	// For MDC files, we need to preserve YAML frontmatter at the top
	// So we wrap only the content after frontmatter
	let wrappedContent: string;
	if (isMdc) {
		const [frontmatter, body] = extractFrontmatter(srcContent);
		if (frontmatter) {
			// Wrap only the body, keep frontmatter at top
			wrappedContent = `${frontmatter}\n${MEMORIA_START}\n${body}\n${MEMORIA_END}\n`;
		} else {
			wrappedContent = `${MEMORIA_START}\n${srcContent}\n${MEMORIA_END}\n`;
		}
	} else {
		wrappedContent = `${MEMORIA_START}\n${srcContent}\n${MEMORIA_END}\n`;
	}

	// Create destination directory if needed
	const destDir = path.dirname(destPath);
	if (!fs.existsSync(destDir)) {
		fs.mkdirSync(destDir, { recursive: true });
	}

	if (!fs.existsSync(destPath)) {
		// New file - create with markers
		fs.writeFileSync(destPath, wrappedContent);
		return "created";
	}

	const existingContent = fs.readFileSync(destPath, "utf8");

	if (existingContent.includes(MEMORIA_START)) {
		if (force) {
			// Replace existing Memoria section
			const updated = existingContent.replace(
				/<!-- MEMORIA:START -->[\s\S]*?<!-- MEMORIA:END -->\n?/,
				`${MEMORIA_START}\n${isMdc ? extractFrontmatter(srcContent)[1] : srcContent}\n${MEMORIA_END}\n`,
			);
			fs.writeFileSync(destPath, updated);
			return "updated";
		}
		return "skipped";
	}

	// Append to existing file (preserves user content)
	// For MDC files with frontmatter, insert after the frontmatter
	if (isMdc) {
		const [frontmatter, body] = extractFrontmatter(existingContent);
		if (frontmatter) {
			const memoriaSection = `\n${MEMORIA_START}\n${extractFrontmatter(srcContent)[1]}\n${MEMORIA_END}\n`;
			fs.writeFileSync(destPath, frontmatter + memoriaSection + body);
			return "appended";
		}
	}

	// Standard append for non-MDC or MDC without frontmatter
	const separator = existingContent.endsWith("\n") ? "\n" : "\n\n";
	fs.writeFileSync(destPath, existingContent + separator + wrappedContent);
	return "appended";
}

function installRules(tools: string[], cwd: string, force: boolean): void {
	// Find the rules directory (relative to the compiled CLI or development source)
	let rulesDir = path.join(__dirname, "../rules");

	// In development, rules might be at repo root
	if (!fs.existsSync(rulesDir)) {
		rulesDir = path.join(__dirname, "../../rules");
	}

	if (!fs.existsSync(rulesDir)) {
		console.error("Error: Could not find rules directory");
		console.error("Expected at:", rulesDir);
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
		if (!rule) {
			console.warn(`Warning: Unknown tool "${tool}", skipping`);
			continue;
		}

		const srcPath = path.join(rulesDir, rule.src);
		const destPath = path.join(cwd, rule.dest);

		if (!fs.existsSync(srcPath)) {
			console.warn(`Warning: Rule file not found for ${rule.name}, skipping`);
			continue;
		}

		const result = installRule(srcPath, destPath, force);
		results[result].push(rule.dest);

		// Print action taken
		switch (result) {
			case "created":
				console.log(`  ✓ Created ${rule.dest}`);
				break;
			case "appended":
				console.log(
					`  ✓ Appended to ${rule.dest} (preserved existing content)`,
				);
				break;
			case "updated":
				console.log(`  ✓ Updated ${rule.dest} (--force)`);
				break;
			case "skipped":
				console.log(`  ⊘ Skipped ${rule.dest} (already has Memoria rules)`);
				break;
		}
	}

	// Summary
	const totalInstalled =
		results.created.length + results.appended.length + results.updated.length;
	const totalProcessed = totalInstalled + results.skipped.length;

	console.log("");

	if (totalProcessed === 0) {
		console.log(
			"⚠ No rule files were processed. Check that the tool names are correct.",
		);
		console.log("Valid tools: cursor, claude, windsurf, cline");
		return;
	}

	if (totalInstalled > 0) {
		console.log(`✓ Installed/updated ${totalInstalled} rule file(s)`);
		console.log(
			"\nMemoria will now guide your AI to check for hidden dependencies before editing files.",
		);
	} else if (results.skipped.length > 0) {
		console.log("All rule files already installed.");
	}

	if (results.skipped.length > 0 && totalInstalled > 0) {
		console.log(
			`\nℹ ${results.skipped.length} file(s) skipped (use --force to update existing rules)`,
		);
	} else if (results.skipped.length > 0 && totalInstalled === 0) {
		console.log(`\nUse --force to update existing Memoria rules.`);
	}
}

function runServer(): void {
	// Run the MCP server (for npx/MCP config compatibility)
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

function main() {
	const args = process.argv.slice(2);
	const cwd = process.cwd();

	// No arguments = run MCP server (for npx -y @byronwade/memoria compatibility)
	// This allows the same command to work for both MCP configs and CLI usage
	if (args.length === 0) {
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
		console.log('Run "memoria init --help" for usage');
		console.log('Run "memoria" (no args) to start the MCP server');
		process.exit(1);
	}

	// Parse flags
	const flags = args.slice(1).filter((a) => a.startsWith("--"));
	const force = flags.includes("--force");

	// Filter out non-tool flags for tool selection
	const toolFlags = flags.filter((f) => f !== "--force" && f !== "--all");
	let tools: string[] = [];

	if (flags.includes("--all")) {
		tools = Object.keys(RULES);
	} else if (toolFlags.length > 0) {
		tools = toolFlags.map((f) => f.slice(2)); // Remove "--" prefix
	} else {
		// Auto-detect
		tools = detectTools(cwd);
		if (tools.length === 0) {
			console.log("No AI tools detected in current directory.");
			console.log(
				"Use --cursor, --claude, --windsurf, --cline, or --all to specify which rules to install.",
			);
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
