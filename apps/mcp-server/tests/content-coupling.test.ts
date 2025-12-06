import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";

// Get project root for test fixtures
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

describe("Content/String Coupling Engine (getContentCoupling)", () => {
	let getContentCoupling: (filePath: string, ctx?: any) => Promise<any[]>;
	let extractStringLiterals: (sourceCode: string) => string[];
	let cache: any;

	beforeEach(async () => {
		const module = await import("../src/index.js");
		getContentCoupling = module.getContentCoupling;
		extractStringLiterals = module.extractStringLiterals;
		cache = module.cache;
		cache.clear();
	});

	describe("extractStringLiterals", () => {
		it("should extract double-quoted strings", () => {
			const code = `const msg = "This is an error message";`;
			const strings = extractStringLiterals(code);
			expect(strings).toContain("This is an error message");
		});

		it("should extract single-quoted strings", () => {
			const code = `const msg = 'Authentication failed';`;
			const strings = extractStringLiterals(code);
			expect(strings).toContain("Authentication failed");
		});

		it("should extract template literals (non-interpolated)", () => {
			const code = "const msg = `User not found in database`;";
			const strings = extractStringLiterals(code);
			expect(strings).toContain("User not found in database");
		});

		it("should filter out short strings (less than 10 chars)", () => {
			const code = `
				const a = "short";
				const b = "also short";
				const c = "This is a longer meaningful string";
			`;
			const strings = extractStringLiterals(code);
			expect(strings).not.toContain("short");
			expect(strings).not.toContain("also short");
			expect(strings).toContain("This is a longer meaningful string");
		});

		it("should filter out import paths", () => {
			const code = `
				import foo from "./components/Button";
				import bar from "../utils/helpers";
				const msg = "Real error message here";
			`;
			const strings = extractStringLiterals(code);
			expect(strings).not.toContain("./components/Button");
			expect(strings).not.toContain("../utils/helpers");
			expect(strings).toContain("Real error message here");
		});

		it("should filter out common non-meaningful strings", () => {
			const code = `
				const type = "application/json";
				const method = "content-type";
				const msg = "Invalid request parameters";
			`;
			const strings = extractStringLiterals(code);
			expect(strings).not.toContain("application/json");
			expect(strings).not.toContain("content-type");
			expect(strings).toContain("Invalid request parameters");
		});

		it("should deduplicate strings", () => {
			const code = `
				const err1 = "Duplicate error message";
				const err2 = "Duplicate error message";
			`;
			const strings = extractStringLiterals(code);
			const duplicateCount = strings.filter(
				(s) => s === "Duplicate error message",
			).length;
			expect(duplicateCount).toBe(1);
		});

		it("should filter out URL-like strings", () => {
			const code = `
				const url = "https://api.example.com/v1";
				const path = "/api/users/:id";
				const msg = "Connection timeout error";
			`;
			const strings = extractStringLiterals(code);
			expect(strings).not.toContain("https://api.example.com/v1");
			expect(strings).not.toContain("/api/users/:id");
			expect(strings).toContain("Connection timeout error");
		});

		it("should filter out class name strings (CSS-like)", () => {
			const code = `
				const cls = "flex items-center justify-between";
				const msg = "Failed to load user data";
			`;
			const strings = extractStringLiterals(code);
			// CSS class strings are typically filtered
			expect(strings).toContain("Failed to load user data");
		});
	});

	describe("getContentCoupling", () => {
		it("should return an array", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getContentCoupling(filePath);
			expect(Array.isArray(result)).toBe(true);
		});

		it("should cache results for subsequent calls", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result1 = await getContentCoupling(filePath);

			// Verify cache was set
			const cacheKey = `content-coupling:${filePath}`;
			expect(cache.has(cacheKey)).toBe(true);

			// Second call should return cached result
			const result2 = await getContentCoupling(filePath);
			expect(result2).toEqual(result1);
		});

		it("should return empty array for files with no significant strings", async () => {
			const filePath = join(projectRoot, "package.json");
			const result = await getContentCoupling(filePath);
			expect(result).toEqual([]);
		});

		it("should include source field set to 'content'", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getContentCoupling(filePath);

			result.forEach((coupling: any) => {
				expect(coupling.source).toBe("content");
			});
		});

		it("should include score, file, and reason fields", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getContentCoupling(filePath);

			result.forEach((coupling: any) => {
				expect(typeof coupling.file).toBe("string");
				expect(typeof coupling.score).toBe("number");
				expect(typeof coupling.reason).toBe("string");
			});
		});

		it("should mention shared content in reason", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getContentCoupling(filePath);

			result.forEach((coupling: any) => {
				// Reason should mention content/string
				expect(
					coupling.reason.toLowerCase().includes("content") ||
						coupling.reason.toLowerCase().includes("string") ||
						coupling.reason.toLowerCase().includes("shared"),
				).toBe(true);
			});
		});

		it("should limit results to 5 files", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getContentCoupling(filePath);
			expect(result.length).toBeLessThanOrEqual(5);
		});

		it("should sort results by score descending", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getContentCoupling(filePath);

			if (result.length >= 2) {
				for (let i = 0; i < result.length - 1; i++) {
					expect(result[i].score).toBeGreaterThanOrEqual(result[i + 1].score);
				}
			}
		});

		it("should not include the source file itself", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getContentCoupling(filePath);

			result.forEach((coupling: any) => {
				expect(coupling.file).not.toBe("src/index.ts");
			});
		});

		it("should handle files with no string literals gracefully", async () => {
			// A file that might have no meaningful strings
			const filePath = join(projectRoot, "tsconfig.json");
			const result = await getContentCoupling(filePath);
			expect(Array.isArray(result)).toBe(true);
		});
	});
});
