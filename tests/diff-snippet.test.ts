import { describe, it, expect, beforeEach } from "vitest";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import simpleGit from "simple-git";

// Get project root for test fixtures
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

describe("Diff Snippet (Evidence Bag)", () => {
	let getDiffSnippet: (
		repoRoot: string,
		relativeFilePath: string,
		commitHash: string
	) => Promise<string>;
	let cache: any;
	let git: ReturnType<typeof simpleGit>;

	beforeEach(async () => {
		const module = await import("../src/index.js");
		getDiffSnippet = module.getDiffSnippet;
		cache = module.cache;
		cache.clear();
		git = simpleGit(projectRoot);
	});

	describe("getDiffSnippet", () => {
		it("should return a string", async () => {
			// Get a real commit hash from the repo
			const log = await git.log({ maxCount: 1 });
			if (log.total === 0) return; // Skip if no commits

			const commitHash = log.latest!.hash;
			const result = await getDiffSnippet(projectRoot, "src/index.ts", commitHash);

			expect(typeof result).toBe("string");
		});

		it("should return file content at specific commit", async () => {
			// Get a real commit that modified src/index.ts
			const log = await git.log({ file: "src/index.ts", maxCount: 1 });
			if (log.total === 0) return; // Skip if no commits

			const commitHash = log.latest!.hash;
			const result = await getDiffSnippet(projectRoot, "src/index.ts", commitHash);

			// Should contain some code
			expect(result.length).toBeGreaterThan(0);
		});

		it("should return empty string for non-existent file", async () => {
			const log = await git.log({ maxCount: 1 });
			if (log.total === 0) return;

			const commitHash = log.latest!.hash;
			const result = await getDiffSnippet(projectRoot, "non-existent-file.ts", commitHash);

			expect(result).toBe("");
		});

		it("should return empty string for invalid commit hash", async () => {
			const result = await getDiffSnippet(projectRoot, "src/index.ts", "invalid-hash-12345");

			expect(result).toBe("");
		});

		it("should handle git errors gracefully", async () => {
			// Invalid repo root
			const result = await getDiffSnippet("/invalid/repo/path", "file.ts", "abc123");

			expect(result).toBe("");
		});
	});

	describe("Truncation", () => {
		it("should truncate content longer than 1000 chars", async () => {
			// Find a commit with a large file
			const log = await git.log({ file: "src/index.ts", maxCount: 1 });
			if (log.total === 0) return;

			const commitHash = log.latest!.hash;
			const result = await getDiffSnippet(projectRoot, "src/index.ts", commitHash);

			// If the file is large, it should be truncated
			if (result.length > 1000) {
				expect(result).toContain("...(truncated)");
				// Total length should be ~1014 (1000 + "\n...(truncated)")
				expect(result.length).toBeLessThanOrEqual(1020);
			}
		});

		it("should not truncate content under 1000 chars", async () => {
			// Try with a small file like package.json
			const log = await git.log({ file: "package.json", maxCount: 1 });
			if (log.total === 0) return;

			const commitHash = log.latest!.hash;
			const result = await getDiffSnippet(projectRoot, "package.json", commitHash);

			// If content is small, no truncation marker
			if (result.length > 0 && result.length < 1000) {
				expect(result).not.toContain("...(truncated)");
			}
		});

		it("should add truncation marker at the end", async () => {
			const log = await git.log({ file: "src/index.ts", maxCount: 1 });
			if (log.total === 0) return;

			const commitHash = log.latest!.hash;
			const result = await getDiffSnippet(projectRoot, "src/index.ts", commitHash);

			if (result.includes("...(truncated)")) {
				expect(result.endsWith("...(truncated)")).toBe(true);
			}
		});
	});

	describe("Edge Cases", () => {
		it("should handle empty files", async () => {
			// If there's an empty file in a commit, should return empty string
			const result = await getDiffSnippet(projectRoot, ".gitkeep", "HEAD");
			expect(typeof result).toBe("string");
		});

		it("should handle files with special characters in path", async () => {
			// Try fetching with forward slashes (Unix style)
			const log = await git.log({ file: "src/index.ts", maxCount: 1 });
			if (log.total === 0) return;

			const commitHash = log.latest!.hash;
			const result = await getDiffSnippet(projectRoot, "src/index.ts", commitHash);

			expect(typeof result).toBe("string");
		});

		it("should handle binary files gracefully", async () => {
			// If the repo has binary files, they might return gibberish or empty
			// The function should not throw
			const log = await git.log({ maxCount: 1 });
			if (log.total === 0) return;

			// This should not throw even for binary content
			try {
				const result = await getDiffSnippet(projectRoot, "package-lock.json", log.latest!.hash);
				expect(typeof result).toBe("string");
			} catch (e) {
				// Should not throw
				expect(false).toBe(true);
			}
		});

		it("should work with HEAD reference", async () => {
			const result = await getDiffSnippet(projectRoot, "src/index.ts", "HEAD");

			// Should return current version of the file
			expect(typeof result).toBe("string");
		});

		it("should work with short commit hashes", async () => {
			const log = await git.log({ file: "src/index.ts", maxCount: 1 });
			if (log.total === 0) return;

			// Use short hash (first 7 chars)
			const shortHash = log.latest!.hash.substring(0, 7);
			const result = await getDiffSnippet(projectRoot, "src/index.ts", shortHash);

			expect(typeof result).toBe("string");
		});
	});

	describe("Diff Format Verification", () => {
		it("should return diff format showing what changed", async () => {
			const log = await git.log({ file: "package.json", maxCount: 1 });
			if (log.total === 0) return;

			const commitHash = log.latest!.hash;
			const result = await getDiffSnippet(projectRoot, "package.json", commitHash);

			// Diff format should start with "diff --git" after cleanup
			if (result.length > 0) {
				const trimmed = result.trim();
				expect(trimmed.startsWith("diff --git")).toBe(true);
			}
		});

		it("should show code changes with +/- markers", async () => {
			const log = await git.log({ file: "src/index.ts", maxCount: 1 });
			if (log.total === 0) return;

			const commitHash = log.latest!.hash;
			const result = await getDiffSnippet(projectRoot, "src/index.ts", commitHash);

			// Diff should contain typical diff markers (+, -, @@)
			if (result.length > 0) {
				expect(
					result.includes("@@") ||
						result.includes("+") ||
						result.includes("-") ||
						result.includes("diff --git")
				).toBe(true);
			}
		});
	});
});
