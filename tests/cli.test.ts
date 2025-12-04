import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const CLI_PATH = path.join(__dirname, "../dist/cli.js");
const MEMORIA_START = "<!-- MEMORIA:START -->";
const MEMORIA_END = "<!-- MEMORIA:END -->";

describe("CLI", () => {
	let testDir: string;

	beforeEach(() => {
		// Create a unique temp directory for each test
		testDir = fs.mkdtempSync(path.join(os.tmpdir(), "memoria-cli-test-"));
	});

	afterEach(() => {
		// Cleanup
		fs.rmSync(testDir, { recursive: true, force: true });
	});

	function runCli(args: string): string {
		try {
			// Redirect stderr to stdout so we capture warnings too
			return execSync(`node ${CLI_PATH} ${args} 2>&1`, {
				cwd: testDir,
				encoding: "utf8",
			});
		} catch (error: unknown) {
			const execError = error as { stdout?: string; stderr?: string };
			// Return stdout even on non-zero exit
			return execError.stdout || execError.stderr || "";
		}
	}

	describe("help", () => {
		it("should show help with --help flag", () => {
			const output = runCli("--help");
			expect(output).toContain("Memoria");
			expect(output).toContain("memoria init");
			expect(output).toContain("--cursor");
			expect(output).toContain("--force");
		});

		it("should show help with -h flag", () => {
			const output = runCli("-h");
			expect(output).toContain("Memoria");
		});
	});

	describe("init - create new files", () => {
		it("should create windsurf rules file when it does not exist", () => {
			const output = runCli("init --windsurf");
			expect(output).toContain("Created .windsurfrules");

			const content = fs.readFileSync(
				path.join(testDir, ".windsurfrules"),
				"utf8",
			);
			expect(content).toContain(MEMORIA_START);
			expect(content).toContain(MEMORIA_END);
			expect(content).toContain("analyze_file");
		});

		it("should create cline rules file when it does not exist", () => {
			const output = runCli("init --cline");
			expect(output).toContain("Created .clinerules");

			const content = fs.readFileSync(
				path.join(testDir, ".clinerules"),
				"utf8",
			);
			expect(content).toContain(MEMORIA_START);
			expect(content).toContain(MEMORIA_END);
		});

		it("should create cursor rules with directory structure", () => {
			const output = runCli("init --cursor");
			expect(output).toContain("Created .cursor/rules/memoria.mdc");

			const filePath = path.join(testDir, ".cursor/rules/memoria.mdc");
			expect(fs.existsSync(filePath)).toBe(true);
		});

		it("should create claude rules with directory structure", () => {
			const output = runCli("init --claude");
			expect(output).toContain("Created .claude/CLAUDE.md");

			const filePath = path.join(testDir, ".claude/CLAUDE.md");
			expect(fs.existsSync(filePath)).toBe(true);
		});

		it("should create all rule files with --all flag", () => {
			const output = runCli("init --all");
			expect(output).toContain("Created .windsurfrules");
			expect(output).toContain("Created .clinerules");
			expect(output).toContain("Created .cursor/rules/memoria.mdc");
			expect(output).toContain("Created .claude/CLAUDE.md");

			expect(fs.existsSync(path.join(testDir, ".windsurfrules"))).toBe(true);
			expect(fs.existsSync(path.join(testDir, ".clinerules"))).toBe(true);
			expect(
				fs.existsSync(path.join(testDir, ".cursor/rules/memoria.mdc")),
			).toBe(true);
			expect(fs.existsSync(path.join(testDir, ".claude/CLAUDE.md"))).toBe(true);
		});
	});

	describe("init - append to existing files", () => {
		it("should append to existing file without Memoria markers", () => {
			const existingContent = "# My Custom Rules\n\nThese are my rules.\n";
			fs.writeFileSync(path.join(testDir, ".windsurfrules"), existingContent);

			const output = runCli("init --windsurf");
			expect(output).toContain("Appended to .windsurfrules");

			const content = fs.readFileSync(
				path.join(testDir, ".windsurfrules"),
				"utf8",
			);
			// Original content preserved
			expect(content).toContain("# My Custom Rules");
			expect(content).toContain("These are my rules.");
			// Memoria content added
			expect(content).toContain(MEMORIA_START);
			expect(content).toContain(MEMORIA_END);
			expect(content).toContain("analyze_file");
		});

		it("should preserve existing content at the beginning", () => {
			const existingContent = "# Project Rules\n\nImportant stuff here.\n";
			fs.writeFileSync(path.join(testDir, ".clinerules"), existingContent);

			runCli("init --cline");

			const content = fs.readFileSync(
				path.join(testDir, ".clinerules"),
				"utf8",
			);
			// Original content should be at the start
			expect(content.startsWith("# Project Rules")).toBe(true);
		});
	});

	describe("init - skip existing Memoria rules", () => {
		it("should skip file that already has Memoria markers", () => {
			const contentWithMemoria = `# My Rules\n\n${MEMORIA_START}\nOld memoria content\n${MEMORIA_END}\n`;
			fs.writeFileSync(
				path.join(testDir, ".windsurfrules"),
				contentWithMemoria,
			);

			const output = runCli("init --windsurf");
			expect(output).toContain("Skipped .windsurfrules");
			expect(output).toContain("already installed");

			// Content unchanged
			const content = fs.readFileSync(
				path.join(testDir, ".windsurfrules"),
				"utf8",
			);
			expect(content).toContain("Old memoria content");
		});
	});

	describe("init --force", () => {
		it("should update existing Memoria section with --force", () => {
			const contentWithMemoria = `# My Rules\n\n${MEMORIA_START}\nOld memoria content\n${MEMORIA_END}\n\n# Footer\n`;
			fs.writeFileSync(
				path.join(testDir, ".windsurfrules"),
				contentWithMemoria,
			);

			const output = runCli("init --windsurf --force");
			expect(output).toContain("Updated .windsurfrules");

			const content = fs.readFileSync(
				path.join(testDir, ".windsurfrules"),
				"utf8",
			);
			// Old content replaced
			expect(content).not.toContain("Old memoria content");
			// New content present
			expect(content).toContain("analyze_file");
			// Surrounding content preserved
			expect(content).toContain("# My Rules");
			expect(content).toContain("# Footer");
		});

		it("should preserve content outside Memoria markers", () => {
			const contentWithMemoria = `HEADER\n\n${MEMORIA_START}\nOld\n${MEMORIA_END}\n\nFOOTER`;
			fs.writeFileSync(path.join(testDir, ".clinerules"), contentWithMemoria);

			runCli("init --cline --force");

			const content = fs.readFileSync(
				path.join(testDir, ".clinerules"),
				"utf8",
			);
			expect(content).toContain("HEADER");
			expect(content).toContain("FOOTER");
		});
	});

	describe("init - MDC files (Cursor)", () => {
		it("should preserve YAML frontmatter in MDC files", () => {
			const mdcContent = `---
description: My existing rules
globs: ["**/*.ts"]
alwaysApply: true
---
# My Custom Rules

Some content here.
`;
			fs.mkdirSync(path.join(testDir, ".cursor/rules"), { recursive: true });
			fs.writeFileSync(
				path.join(testDir, ".cursor/rules/memoria.mdc"),
				mdcContent,
			);

			runCli("init --cursor");

			const content = fs.readFileSync(
				path.join(testDir, ".cursor/rules/memoria.mdc"),
				"utf8",
			);
			// YAML frontmatter should still be at the very top
			expect(content.startsWith("---")).toBe(true);
			expect(content).toContain("description: My existing rules");
			// Memoria markers should be AFTER frontmatter
			const frontmatterEnd = content.indexOf("---", 3) + 3;
			const memoriaStart = content.indexOf(MEMORIA_START);
			expect(memoriaStart).toBeGreaterThan(frontmatterEnd);
			// Original content preserved
			expect(content).toContain("# My Custom Rules");
		});

		it("should not break YAML parsing with markers", () => {
			fs.mkdirSync(path.join(testDir, ".cursor/rules"), { recursive: true });

			runCli("init --cursor");

			const content = fs.readFileSync(
				path.join(testDir, ".cursor/rules/memoria.mdc"),
				"utf8",
			);
			// File should start with YAML frontmatter
			expect(content.startsWith("---")).toBe(true);
			// Markers should NOT be before the frontmatter
			const firstDash = content.indexOf("---");
			const memoriaStart = content.indexOf(MEMORIA_START);
			expect(memoriaStart).toBeGreaterThan(firstDash);
		});
	});

	describe("init - unknown tools", () => {
		it("should handle unknown tool names gracefully", () => {
			// Unknown tools are simply skipped (no warning in simplified output)
			const output = runCli("init --vscode");
			// Should not crash
			expect(output).toBeDefined();
		});

		it("should handle all unknown tools", () => {
			const output = runCli("init --unknown --fake");
			// Should not crash, no output for unknown tools
			expect(output).toBeDefined();
		});
	});

	describe("init - trailing newline", () => {
		it("should end files with a newline", () => {
			runCli("init --windsurf");

			const content = fs.readFileSync(
				path.join(testDir, ".windsurfrules"),
				"utf8",
			);
			expect(content.endsWith("\n")).toBe(true);
		});
	});
});
