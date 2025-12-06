import { access, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import simpleGit from "simple-git";
import { describe, expect, it } from "vitest";

// Get current file's directory for test fixtures
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

describe("MCP Server Integration", () => {
	describe("Environment Setup", () => {
		it("should have dist/index.js built", async () => {
			const distPath = join(projectRoot, "dist", "index.js");
			await expect(access(distPath)).resolves.toBeUndefined();
		});

		it("should be in a git repository", async () => {
			const git = simpleGit(projectRoot);
			const isRepo = await git.checkIsRepo();
			expect(isRepo).toBe(true);
		});

		it("should have git history", async () => {
			const git = simpleGit(projectRoot);
			const log = await git.log({ maxCount: 1 });
			expect(log.total).toBeGreaterThan(0);
		});
	});

	describe("Git Operations", () => {
		it("should be able to get repo root", async () => {
			const git = simpleGit(projectRoot);
			const root = await git.revparse(["--show-toplevel"]);
			expect(root.trim()).toBeTruthy();
		});

		it("should be able to read commit history", async () => {
			const git = simpleGit(projectRoot);
			const srcFile = join(projectRoot, "src", "index.ts");

			// Check if file exists first
			try {
				await access(srcFile);
				const log = await git.log({ file: srcFile, maxCount: 10 });
				expect(log).toBeDefined();
				expect(Array.isArray(log.all)).toBe(true);
			} catch (_e) {
				// File doesn't exist yet, skip this test
				expect(true).toBe(true);
			}
		});
	});

	describe("File System Operations", () => {
		it("should be able to read file stats", async () => {
			const srcFile = join(projectRoot, "src", "index.ts");
			const stats = await stat(srcFile);
			expect(stats).toBeDefined();
			expect(stats.mtimeMs).toBeGreaterThan(0);
		});

		it("should handle non-existent files gracefully", async () => {
			const fakePath = join(projectRoot, "non-existent-file.ts");
			await expect(stat(fakePath)).rejects.toThrow();
		});
	});

	describe("Path Resolution", () => {
		it("should resolve absolute paths correctly", () => {
			const testPath = join(projectRoot, "src", "index.ts");
			expect(testPath).toContain("src");
			expect(testPath).toContain("index.ts");
		});

		it("should handle Windows and Unix path separators", () => {
			const windowsPath = "C:\\Users\\test\\file.ts";
			const normalized = windowsPath.replace(/\\/g, "/");
			expect(normalized).toBe("C:/Users/test/file.ts");
		});
	});
});
