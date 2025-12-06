import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";

// Get project root for test fixtures
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

describe("API Endpoint Coupling Engine (getApiCoupling)", () => {
	let getApiCoupling: (filePath: string, ctx?: any) => Promise<any[]>;
	let extractApiEndpoints: (sourceCode: string) => string[];
	let isApiDefinitionFile: (sourceCode: string) => boolean;
	let cache: any;

	beforeEach(async () => {
		const module = await import("../src/index.js");
		getApiCoupling = module.getApiCoupling;
		extractApiEndpoints = module.extractApiEndpoints;
		isApiDefinitionFile = module.isApiDefinitionFile;
		cache = module.cache;
		cache.clear();
	});

	describe("extractApiEndpoints", () => {
		it("should extract /api/ paths from strings", () => {
			const code = `
				fetch("/api/users");
				axios.get("/api/products");
			`;
			const endpoints = extractApiEndpoints(code);
			expect(endpoints).toContain("/api/users");
			expect(endpoints).toContain("/api/products");
		});

		it("should extract versioned API paths", () => {
			const code = `
				const url = "/v1/auth/login";
				const other = "/v2/users/profile";
			`;
			const endpoints = extractApiEndpoints(code);
			expect(endpoints).toContain("/v1/auth/login");
			expect(endpoints).toContain("/v2/users/profile");
		});

		it("should extract route definitions from Express-style code", () => {
			const code = `
				app.get("/users", handler);
				app.post("/auth/login", loginHandler);
				router.delete("/items/:id", deleteHandler);
			`;
			const endpoints = extractApiEndpoints(code);
			expect(endpoints).toContain("/users");
			expect(endpoints).toContain("/auth/login");
			expect(endpoints.some(e => e.includes("/items"))).toBe(true);
		});

		it("should extract decorator routes from NestJS/Spring style", () => {
			const code = `
				@Get("/users")
				getUsers() {}

				@Post("/products")
				createProduct() {}
			`;
			const endpoints = extractApiEndpoints(code);
			expect(endpoints).toContain("/users");
			expect(endpoints).toContain("/products");
		});

		it("should clean up dynamic segments", () => {
			const code = `
				app.get("/users/:id", handler);
				fetch("/api/products/:productId/reviews");
			`;
			const endpoints = extractApiEndpoints(code);
			// Dynamic segments should be cleaned
			expect(endpoints.some(e => e.includes(":id"))).toBe(false);
			expect(endpoints.some(e => e.includes(":productId"))).toBe(false);
		});

		it("should deduplicate endpoints", () => {
			const code = `
				fetch("/api/users");
				fetch("/api/users");
				fetch("/api/users");
			`;
			const endpoints = extractApiEndpoints(code);
			const userCount = endpoints.filter((e) => e === "/api/users").length;
			expect(userCount).toBe(1);
		});

		it("should limit to 10 endpoints", () => {
			const code = `
				fetch("/api/1"); fetch("/api/2"); fetch("/api/3");
				fetch("/api/4"); fetch("/api/5"); fetch("/api/6");
				fetch("/api/7"); fetch("/api/8"); fetch("/api/9");
				fetch("/api/10"); fetch("/api/11"); fetch("/api/12");
			`;
			const endpoints = extractApiEndpoints(code);
			expect(endpoints.length).toBeLessThanOrEqual(10);
		});
	});

	describe("isApiDefinitionFile", () => {
		it("should detect Express routes", () => {
			const code = "app.get('/users', handler);";
			expect(isApiDefinitionFile(code)).toBe(true);
		});

		it("should detect router definitions", () => {
			const code = "router.post('/auth', authHandler);";
			expect(isApiDefinitionFile(code)).toBe(true);
		});

		it("should detect NestJS decorators", () => {
			const code = "@Get('/users') getUsers() {}";
			expect(isApiDefinitionFile(code)).toBe(true);
		});

		it("should detect Next.js API routes", () => {
			const code = "export async function GET(request) {}";
			expect(isApiDefinitionFile(code)).toBe(true);
		});

		it("should return false for regular code", () => {
			const code = "function hello() { return 'world'; }";
			expect(isApiDefinitionFile(code)).toBe(false);
		});

		it("should return false for API consumers", () => {
			const code = "fetch('/api/users').then(res => res.json());";
			expect(isApiDefinitionFile(code)).toBe(false);
		});
	});

	describe("getApiCoupling", () => {
		it("should return an array", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getApiCoupling(filePath);
			expect(Array.isArray(result)).toBe(true);
		});

		it("should cache results for subsequent calls", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result1 = await getApiCoupling(filePath);

			// Verify cache was set
			const cacheKey = `api-coupling:${filePath}`;
			expect(cache.has(cacheKey)).toBe(true);

			// Second call should return cached result
			const result2 = await getApiCoupling(filePath);
			expect(result2).toEqual(result1);
		});

		it("should return empty array for non-API files", async () => {
			// package.json is not an API definition file
			const filePath = join(projectRoot, "package.json");
			const result = await getApiCoupling(filePath);
			expect(result).toEqual([]);
		});

		it("should include source field set to 'api'", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getApiCoupling(filePath);

			result.forEach((coupling: any) => {
				expect(coupling.source).toBe("api");
			});
		});

		it("should include score, file, and reason fields", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getApiCoupling(filePath);

			result.forEach((coupling: any) => {
				expect(typeof coupling.file).toBe("string");
				expect(typeof coupling.score).toBe("number");
				expect(typeof coupling.reason).toBe("string");
			});
		});

		it("should mention endpoints in reason", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getApiCoupling(filePath);

			result.forEach((coupling: any) => {
				expect(coupling.reason.toLowerCase()).toMatch(/call|endpoint|response/);
			});
		});

		it("should limit results to 5 files", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getApiCoupling(filePath);
			expect(result.length).toBeLessThanOrEqual(5);
		});

		it("should sort results by score descending", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getApiCoupling(filePath);

			if (result.length >= 2) {
				for (let i = 0; i < result.length - 1; i++) {
					expect(result[i].score).toBeGreaterThanOrEqual(result[i + 1].score);
				}
			}
		});

		it("should not include the source file itself", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getApiCoupling(filePath);

			result.forEach((coupling: any) => {
				expect(coupling.file).not.toBe("src/index.ts");
			});
		});
	});
});
