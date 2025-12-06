import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";

// Get project root for test fixtures
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

describe("Environment Variable Coupling Engine (getEnvCoupling)", () => {
	let getEnvCoupling: (filePath: string, ctx?: any) => Promise<any[]>;
	let extractEnvVars: (sourceCode: string) => string[];
	let cache: any;

	beforeEach(async () => {
		const module = await import("../src/index.js");
		getEnvCoupling = module.getEnvCoupling;
		extractEnvVars = module.extractEnvVars;
		cache = module.cache;
		cache.clear();
	});

	describe("extractEnvVars", () => {
		it("should extract environment variables with common prefixes", () => {
			const code = `
				const key = API_KEY;
				const url = DATABASE_URL;
				const secret = STRIPE_SECRET;
			`;
			const vars = extractEnvVars(code);
			expect(vars).toContain("API_KEY");
			expect(vars).toContain("DATABASE_URL");
			expect(vars).toContain("STRIPE_SECRET");
		});

		it("should extract env vars with common suffixes", () => {
			const code = `
				const token = ACCESS_TOKEN;
				const pass = USER_PASSWORD;
				const host = SERVER_HOST;
			`;
			const vars = extractEnvVars(code);
			expect(vars).toContain("ACCESS_TOKEN");
			expect(vars).toContain("USER_PASSWORD");
			expect(vars).toContain("SERVER_HOST");
		});

		it("should filter out common non-env constants", () => {
			const code = `
				const type = HTTP_METHOD;
				const format = JSON_FORMAT;
				const real = API_SECRET;
			`;
			const vars = extractEnvVars(code);
			expect(vars).not.toContain("HTTP_METHOD");
			expect(vars).not.toContain("JSON_FORMAT");
			expect(vars).toContain("API_SECRET");
		});

		it("should require underscore in variable names", () => {
			const code = `
				const APIKEY = "value";
				const API_KEY = "value";
			`;
			const vars = extractEnvVars(code);
			expect(vars).not.toContain("APIKEY");
			expect(vars).toContain("API_KEY");
		});

		it("should deduplicate variables", () => {
			const code = `
				const a = API_KEY;
				const b = API_KEY;
				const c = API_KEY;
			`;
			const vars = extractEnvVars(code);
			const keyCount = vars.filter((v) => v === "API_KEY").length;
			expect(keyCount).toBe(1);
		});

		it("should limit to 10 variables", () => {
			const code = `
				const a = API_KEY_1;
				const b = API_KEY_2;
				const c = API_KEY_3;
				const d = API_KEY_4;
				const e = API_KEY_5;
				const f = API_KEY_6;
				const g = API_KEY_7;
				const h = API_KEY_8;
				const i = API_KEY_9;
				const j = API_KEY_10;
				const k = API_KEY_11;
				const l = API_KEY_12;
			`;
			const vars = extractEnvVars(code);
			expect(vars.length).toBeLessThanOrEqual(10);
		});

		it("should handle framework-specific prefixes", () => {
			const code = `
				const nextVar = NEXT_PUBLIC_API;
				const viteVar = VITE_API_URL;
				const reactVar = REACT_APP_KEY;
			`;
			const vars = extractEnvVars(code);
			expect(vars).toContain("NEXT_PUBLIC_API");
			expect(vars).toContain("VITE_API_URL");
			expect(vars).toContain("REACT_APP_KEY");
		});
	});

	describe("getEnvCoupling", () => {
		it("should return an array", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getEnvCoupling(filePath);
			expect(Array.isArray(result)).toBe(true);
		});

		it("should cache results for subsequent calls", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result1 = await getEnvCoupling(filePath);

			// Verify cache was set
			const cacheKey = `env-coupling:${filePath}`;
			expect(cache.has(cacheKey)).toBe(true);

			// Second call should return cached result
			const result2 = await getEnvCoupling(filePath);
			expect(result2).toEqual(result1);
		});

		it("should return empty array for files with no env vars", async () => {
			const filePath = join(projectRoot, "package.json");
			const result = await getEnvCoupling(filePath);
			expect(result).toEqual([]);
		});

		it("should include source field set to 'env'", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getEnvCoupling(filePath);

			result.forEach((coupling: any) => {
				expect(coupling.source).toBe("env");
			});
		});

		it("should include score, file, and reason fields", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getEnvCoupling(filePath);

			result.forEach((coupling: any) => {
				expect(typeof coupling.file).toBe("string");
				expect(typeof coupling.score).toBe("number");
				expect(typeof coupling.reason).toBe("string");
			});
		});

		it("should mention shared env vars in reason", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getEnvCoupling(filePath);

			result.forEach((coupling: any) => {
				expect(coupling.reason.toLowerCase()).toMatch(/env|var|share/);
			});
		});

		it("should limit results to 5 files", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getEnvCoupling(filePath);
			expect(result.length).toBeLessThanOrEqual(5);
		});

		it("should sort results by score descending", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getEnvCoupling(filePath);

			if (result.length >= 2) {
				for (let i = 0; i < result.length - 1; i++) {
					expect(result[i].score).toBeGreaterThanOrEqual(result[i + 1].score);
				}
			}
		});

		it("should not include the source file itself", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getEnvCoupling(filePath);

			result.forEach((coupling: any) => {
				expect(coupling.file).not.toBe("src/index.ts");
			});
		});
	});
});
