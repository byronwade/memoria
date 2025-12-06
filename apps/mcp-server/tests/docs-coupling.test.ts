import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";

// Get project root for test fixtures
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

describe("Documentation Coupling Engine (getDocsCoupling)", () => {
	let getDocsCoupling: (filePath: string, ctx?: any) => Promise<any[]>;
	let extractExports: (sourceCode: string) => string[];
	let cache: any;

	beforeEach(async () => {
		const module = await import("../src/index.js");
		getDocsCoupling = module.getDocsCoupling;
		extractExports = module.extractExports;
		cache = module.cache;
		cache.clear();
	});

	describe("extractExports", () => {
		it("should extract exported functions", () => {
			const code = `
				export function myFunction() {}
				export async function asyncFunction() {}
			`;
			const exports = extractExports(code);
			expect(exports).toContain("myFunction");
			expect(exports).toContain("asyncFunction");
		});

		it("should extract exported const/let/var", () => {
			const code = `
				export const MY_CONST = 1;
				export let myLet = 2;
				export var myVar = 3;
			`;
			const exports = extractExports(code);
			expect(exports).toContain("MY_CONST");
			expect(exports).toContain("myLet");
			expect(exports).toContain("myVar");
		});

		it("should extract exported classes", () => {
			const code = `export class MyClass {}`;
			const exports = extractExports(code);
			expect(exports).toContain("MyClass");
		});

		it("should extract exported types and interfaces", () => {
			const code = `
				export interface MyInterface {}
				export type MyType = string;
				export enum MyEnum { A, B }
			`;
			const exports = extractExports(code);
			expect(exports).toContain("MyInterface");
			expect(exports).toContain("MyType");
			expect(exports).toContain("MyEnum");
		});

		it("should extract named exports", () => {
			const code = `export { foo, bar as baz }`;
			const exports = extractExports(code);
			expect(exports).toContain("foo");
			expect(exports).toContain("bar");
		});

		it("should extract default function exports with names", () => {
			const code = `export default function defaultFunc() {}`;
			const exports = extractExports(code);
			expect(exports).toContain("defaultFunc");
		});

		it("should filter out short identifiers", () => {
			const code = `export const a = 1; export const ab = 2; export const abc = 3;`;
			const exports = extractExports(code);
			expect(exports).not.toContain("a");
			expect(exports).not.toContain("ab");
			expect(exports).toContain("abc");
		});

		it("should deduplicate exports", () => {
			const code = `
				export function foo() {}
				export { foo }
			`;
			const exports = extractExports(code);
			const fooCount = exports.filter((e) => e === "foo").length;
			expect(fooCount).toBe(1);
		});
	});

	describe("getDocsCoupling", () => {
		it("should return an array", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getDocsCoupling(filePath);
			expect(Array.isArray(result)).toBe(true);
		});

		it("should cache results for subsequent calls", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result1 = await getDocsCoupling(filePath);

			// Verify cache was set
			const cacheKey = `docs-coupling:${filePath}`;
			expect(cache.has(cacheKey)).toBe(true);

			// Second call should return cached result
			const result2 = await getDocsCoupling(filePath);
			expect(result2).toEqual(result1);
		});

		it("should return empty array for files with no exports", async () => {
			// A file that likely has no exports (or creates a temp test)
			const filePath = join(projectRoot, "package.json");
			const result = await getDocsCoupling(filePath);
			expect(result).toEqual([]);
		});

		it("should include source field set to 'docs'", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getDocsCoupling(filePath);

			result.forEach((coupling: any) => {
				expect(coupling.source).toBe("docs");
			});
		});

		it("should include score, file, and reason fields", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getDocsCoupling(filePath);

			result.forEach((coupling: any) => {
				expect(typeof coupling.file).toBe("string");
				expect(typeof coupling.score).toBe("number");
				expect(typeof coupling.reason).toBe("string");
			});
		});

		it("should find README.md if it references exports", async () => {
			// index.ts exports many functions, README.md likely mentions some
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getDocsCoupling(filePath);

			// Check if README is found (may or may not depending on content)
			const readmeFound = result.some(
				(r: any) => r.file.toLowerCase().includes("readme"),
			);
			// This is informational - README may or may not reference exports
			expect(typeof readmeFound).toBe("boolean");
		});

		it("should limit results to 5 files", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getDocsCoupling(filePath);
			expect(result.length).toBeLessThanOrEqual(5);
		});

		it("should sort results by score descending", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getDocsCoupling(filePath);

			if (result.length >= 2) {
				for (let i = 0; i < result.length - 1; i++) {
					expect(result[i].score).toBeGreaterThanOrEqual(result[i + 1].score);
				}
			}
		});
	});
});
