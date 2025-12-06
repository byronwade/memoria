import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";

// Get project root for test fixtures
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

describe("Type/Semantic Coupling Engine (getTypeCoupling)", () => {
	let getTypeCoupling: (filePath: string, ctx?: any) => Promise<any[]>;
	let extractTypeDefinitions: (sourceCode: string) => string[];
	let cache: any;

	beforeEach(async () => {
		const module = await import("../src/index.js");
		getTypeCoupling = module.getTypeCoupling;
		extractTypeDefinitions = module.extractTypeDefinitions;
		cache = module.cache;
		cache.clear();
	});

	describe("extractTypeDefinitions", () => {
		it("should extract interface definitions", () => {
			const code = `
				interface UserData {}
				export interface PublicUser {}
			`;
			const types = extractTypeDefinitions(code);
			expect(types).toContain("UserData");
			expect(types).toContain("PublicUser");
		});

		it("should extract type aliases", () => {
			const code = `
				type UserId = string;
				export type UserMap = Record<string, User>;
			`;
			const types = extractTypeDefinitions(code);
			expect(types).toContain("UserId");
			expect(types).toContain("UserMap");
		});

		it("should extract enum definitions", () => {
			const code = `
				enum Status { Active, Inactive }
				export enum Priority { Low, Medium, High }
			`;
			const types = extractTypeDefinitions(code);
			expect(types).toContain("Status");
			expect(types).toContain("Priority");
		});

		it("should filter out generic/common type names", () => {
			const code = `
				interface Props {}
				interface State {}
				interface Options {}
				interface Config {}
				interface CustomUserData {}
			`;
			const types = extractTypeDefinitions(code);
			expect(types).not.toContain("Props");
			expect(types).not.toContain("State");
			expect(types).not.toContain("Options");
			expect(types).not.toContain("Config");
			expect(types).toContain("CustomUserData");
		});

		it("should deduplicate type names", () => {
			const code = `
				interface MyType {}
				type MyType = string;
			`;
			const types = extractTypeDefinitions(code);
			const myTypeCount = types.filter((t) => t === "MyType").length;
			expect(myTypeCount).toBe(1);
		});

		it("should filter out short type names", () => {
			const code = `
				type A = string;
				type AB = number;
				type ABC = boolean;
			`;
			const types = extractTypeDefinitions(code);
			expect(types).not.toContain("A");
			expect(types).not.toContain("AB");
			expect(types).toContain("ABC");
		});
	});

	describe("getTypeCoupling", () => {
		it("should return an array", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getTypeCoupling(filePath);
			expect(Array.isArray(result)).toBe(true);
		});

		it("should cache results for subsequent calls", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result1 = await getTypeCoupling(filePath);

			// Verify cache was set
			const cacheKey = `type-coupling:${filePath}`;
			expect(cache.has(cacheKey)).toBe(true);

			// Second call should return cached result
			const result2 = await getTypeCoupling(filePath);
			expect(result2).toEqual(result1);
		});

		it("should return empty array for files with no type definitions", async () => {
			const filePath = join(projectRoot, "package.json");
			const result = await getTypeCoupling(filePath);
			expect(result).toEqual([]);
		});

		it("should include source field set to 'type'", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getTypeCoupling(filePath);

			result.forEach((coupling: any) => {
				expect(coupling.source).toBe("type");
			});
		});

		it("should include score, file, and reason fields", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getTypeCoupling(filePath);

			result.forEach((coupling: any) => {
				expect(typeof coupling.file).toBe("string");
				expect(typeof coupling.score).toBe("number");
				expect(typeof coupling.reason).toBe("string");
			});
		});

		it("should mention shared types in reason", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getTypeCoupling(filePath);

			result.forEach((coupling: any) => {
				expect(coupling.reason.toLowerCase()).toContain("type");
			});
		});

		it("should limit results to 5 files", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getTypeCoupling(filePath);
			expect(result.length).toBeLessThanOrEqual(5);
		});

		it("should sort results by score descending", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getTypeCoupling(filePath);

			if (result.length >= 2) {
				for (let i = 0; i < result.length - 1; i++) {
					expect(result[i].score).toBeGreaterThanOrEqual(result[i + 1].score);
				}
			}
		});

		it("should not include the source file itself", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getTypeCoupling(filePath);

			result.forEach((coupling: any) => {
				expect(coupling.file).not.toBe("src/index.ts");
			});
		});
	});
});
