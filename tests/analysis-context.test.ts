import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";

// Get project root for test fixtures
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

describe("AnalysisContext (Performance Optimization)", () => {
	let createAnalysisContext: (targetPath: string) => Promise<any>;
	let cache: any;

	beforeEach(async () => {
		const module = await import("../src/index.js");
		createAnalysisContext = module.createAnalysisContext;
		cache = module.cache;
		cache.clear();
	});

	describe("createAnalysisContext", () => {
		it("should return a context object with all required properties", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const ctx = await createAnalysisContext(filePath);

			expect(ctx).toHaveProperty("targetPath");
			expect(ctx).toHaveProperty("repoRoot");
			expect(ctx).toHaveProperty("git");
			expect(ctx).toHaveProperty("config");
			expect(ctx).toHaveProperty("ig");
			expect(ctx).toHaveProperty("metrics");
		});

		it("should set targetPath to the provided path", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const ctx = await createAnalysisContext(filePath);

			expect(ctx.targetPath).toBe(filePath);
		});

		it("should resolve repoRoot correctly", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const ctx = await createAnalysisContext(filePath);

			expect(ctx.repoRoot).toContain("memoria");
		});

		it("should have a git instance with log method", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const ctx = await createAnalysisContext(filePath);

			expect(typeof ctx.git.log).toBe("function");
		});

		it("should have ignore filter with ignores method", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const ctx = await createAnalysisContext(filePath);

			expect(typeof ctx.ig.ignores).toBe("function");
		});

		it("should have project metrics with expected structure", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const ctx = await createAnalysisContext(filePath);

			expect(ctx.metrics).toHaveProperty("totalCommits");
			expect(ctx.metrics).toHaveProperty("commitsPerWeek");
			expect(ctx.metrics).toHaveProperty("avgFilesPerCommit");
		});

		it("should load config as null or object", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const ctx = await createAnalysisContext(filePath);

			// Config is either null (no .memoria.json) or an object
			expect(ctx.config === null || typeof ctx.config === "object").toBe(true);
		});
	});

	describe("Context Reuse", () => {
		it("should allow engines to use the same git instance", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const ctx = await createAnalysisContext(filePath);

			// The git instance should be reusable for multiple operations
			const log1 = await ctx.git.log({ maxCount: 1 });
			const log2 = await ctx.git.log({ maxCount: 1 });

			// Both should return valid results
			expect(log1.total).toBeGreaterThanOrEqual(0);
			expect(log2.total).toBeGreaterThanOrEqual(0);
		});

		it("should allow engines to use the same ignore filter", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const ctx = await createAnalysisContext(filePath);

			// The ignore filter should work consistently
			const ignores1 = ctx.ig.ignores("node_modules/foo.js");
			const ignores2 = ctx.ig.ignores("node_modules/bar.js");

			expect(ignores1).toBe(true);
			expect(ignores2).toBe(true);
		});
	});

	describe("Engine Integration", () => {
		let getCoupledFiles: any;
		let getVolatility: any;
		let getImporters: any;
		let checkDrift: any;

		beforeEach(async () => {
			const module = await import("../src/index.js");
			getCoupledFiles = module.getCoupledFiles;
			getVolatility = module.getVolatility;
			getImporters = module.getImporters;
			checkDrift = module.checkDrift;
		});

		it("getCoupledFiles should accept context", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const ctx = await createAnalysisContext(filePath);

			// Should not throw when using context
			const result = await getCoupledFiles(filePath, ctx);
			expect(Array.isArray(result)).toBe(true);
		});

		it("getVolatility should accept context", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const ctx = await createAnalysisContext(filePath);

			// Should not throw when using context
			const result = await getVolatility(filePath, ctx);
			expect(result).toHaveProperty("commitCount");
			expect(result).toHaveProperty("panicScore");
		});

		it("getImporters should accept context", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const ctx = await createAnalysisContext(filePath);

			// Should not throw when using context
			const result = await getImporters(filePath, ctx);
			expect(Array.isArray(result)).toBe(true);
		});

		it("checkDrift should accept context", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const ctx = await createAnalysisContext(filePath);
			const coupledFiles = [{ file: "package.json" }];

			// Should not throw when using context
			const result = await checkDrift(filePath, coupledFiles, ctx);
			expect(Array.isArray(result)).toBe(true);
		});

		it("engines should still work with legacy config parameter", async () => {
			const filePath = join(projectRoot, "src", "index.ts");

			// Pass null config (legacy behavior)
			const result = await getVolatility(filePath, null);
			expect(result).toHaveProperty("commitCount");
		});
	});
});
