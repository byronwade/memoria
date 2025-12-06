import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";

// Get project root for test fixtures
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

describe("Schema/Model Coupling Engine (getSchemaCoupling)", () => {
	let getSchemaCoupling: (filePath: string, ctx?: any) => Promise<any[]>;
	let extractSchemaNames: (sourceCode: string) => string[];
	let isSchemaFile: (sourceCode: string) => boolean;
	let cache: any;

	beforeEach(async () => {
		const module = await import("../src/index.js");
		getSchemaCoupling = module.getSchemaCoupling;
		extractSchemaNames = module.extractSchemaNames;
		isSchemaFile = module.isSchemaFile;
		cache = module.cache;
		cache.clear();
	});

	describe("extractSchemaNames", () => {
		it("should extract SQL CREATE TABLE names", () => {
			const code = `
				CREATE TABLE users (id INT);
				CREATE TABLE IF NOT EXISTS orders (id INT);
			`;
			const names = extractSchemaNames(code);
			expect(names).toContain("users");
			expect(names).toContain("orders");
		});

		it("should extract ALTER TABLE names", () => {
			const code = `
				ALTER TABLE products ADD COLUMN price DECIMAL;
			`;
			const names = extractSchemaNames(code);
			expect(names).toContain("products");
		});

		it("should extract Prisma model names", () => {
			const code = `
				model User {
					id Int @id
					name String
				}

				model Post {
					id Int @id
					title String
				}
			`;
			const names = extractSchemaNames(code);
			expect(names).toContain("User");
			expect(names).toContain("Post");
		});

		it("should extract TypeORM/Hibernate decorator names", () => {
			const code = `
				@Entity("users")
				class UserEntity {}

				@Table("products")
				class ProductTable {}
			`;
			const names = extractSchemaNames(code);
			expect(names).toContain("users");
			expect(names).toContain("products");
		});

		it("should extract mongoose model names", () => {
			const code = `
				mongoose.model("User", userSchema);
				mongoose.model("Product", productSchema);
			`;
			const names = extractSchemaNames(code);
			expect(names).toContain("User");
			expect(names).toContain("Product");
		});

		it("should extract class Model definitions", () => {
			const code = `
				class UserModel extends Model {}
				class Order extends Model {}
			`;
			const names = extractSchemaNames(code);
			expect(names).toContain("User");
			expect(names).toContain("Order");
		});

		it("should filter out generic names", () => {
			const code = `
				model Data { id Int }
				model Item { id Int }
				model User { id Int }
			`;
			const names = extractSchemaNames(code);
			expect(names).not.toContain("Data");
			expect(names).not.toContain("Item");
			expect(names).toContain("User");
		});

		it("should deduplicate names", () => {
			const code = `
				CREATE TABLE users (id INT);
				CREATE TABLE users (id INT);
			`;
			const names = extractSchemaNames(code);
			const userCount = names.filter((n) => n === "users").length;
			expect(userCount).toBe(1);
		});
	});

	describe("isSchemaFile", () => {
		it("should detect SQL CREATE TABLE", () => {
			const code = "CREATE TABLE users (id INT);";
			expect(isSchemaFile(code)).toBe(true);
		});

		it("should detect ALTER TABLE", () => {
			const code = "ALTER TABLE users ADD COLUMN name VARCHAR;";
			expect(isSchemaFile(code)).toBe(true);
		});

		it("should detect TypeORM decorators", () => {
			const code = "@Entity() class User {}";
			expect(isSchemaFile(code)).toBe(true);
		});

		it("should detect Prisma models", () => {
			const code = "model User { id Int @id }";
			expect(isSchemaFile(code)).toBe(true);
		});

		it("should detect mongoose Schema", () => {
			const code = "new mongoose.Schema({})";
			expect(isSchemaFile(code)).toBe(true);
		});

		it("should return false for regular code", () => {
			const code = "function hello() { return 'world'; }";
			expect(isSchemaFile(code)).toBe(false);
		});
	});

	describe("getSchemaCoupling", () => {
		it("should return an array", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getSchemaCoupling(filePath);
			expect(Array.isArray(result)).toBe(true);
		});

		it("should cache results for subsequent calls", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result1 = await getSchemaCoupling(filePath);

			// Verify cache was set
			const cacheKey = `schema-coupling:${filePath}`;
			expect(cache.has(cacheKey)).toBe(true);

			// Second call should return cached result
			const result2 = await getSchemaCoupling(filePath);
			expect(result2).toEqual(result1);
		});

		it("should return empty array for non-schema files", async () => {
			// package.json is not a schema file
			const filePath = join(projectRoot, "package.json");
			const result = await getSchemaCoupling(filePath);
			expect(result).toEqual([]);
		});

		it("should include source field set to 'schema'", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getSchemaCoupling(filePath);

			result.forEach((coupling: any) => {
				expect(coupling.source).toBe("schema");
			});
		});

		it("should include score, file, and reason fields", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getSchemaCoupling(filePath);

			result.forEach((coupling: any) => {
				expect(typeof coupling.file).toBe("string");
				expect(typeof coupling.score).toBe("number");
				expect(typeof coupling.reason).toBe("string");
			});
		});

		it("should limit results to 5 files", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getSchemaCoupling(filePath);
			expect(result.length).toBeLessThanOrEqual(5);
		});

		it("should sort results by score descending", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getSchemaCoupling(filePath);

			if (result.length >= 2) {
				for (let i = 0; i < result.length - 1; i++) {
					expect(result[i].score).toBeGreaterThanOrEqual(result[i + 1].score);
				}
			}
		});

		it("should not include the source file itself", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getSchemaCoupling(filePath);

			result.forEach((coupling: any) => {
				expect(coupling.file).not.toBe("src/index.ts");
			});
		});
	});
});
