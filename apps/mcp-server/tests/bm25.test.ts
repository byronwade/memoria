import { describe, it, expect } from "vitest";
import {
	buildBM25Index,
	calculateBM25Score,
	searchBM25,
	extractKeywords,
	extractFileKeywords,
	extractCodeKeywords,
	combineKeywords,
	keywordSimilarity,
} from "../src/bm25.js";

describe("BM25 Search Engine", () => {
	describe("buildBM25Index", () => {
		it("should build an index from documents", () => {
			const docs = [
				["hello", "world"],
				["hello", "test"],
				["foo", "bar"],
			];
			const index = buildBM25Index(docs);

			expect(index.totalDocs).toBe(3);
			expect(index.avgDocLength).toBe(2);
			expect(index.docFrequencies.get("hello")).toBe(2);
			expect(index.docFrequencies.get("world")).toBe(1);
		});

		it("should handle empty documents", () => {
			const index = buildBM25Index([]);
			expect(index.totalDocs).toBe(0);
			expect(index.avgDocLength).toBe(0);
		});
	});

	describe("calculateBM25Score", () => {
		it("should return higher scores for matching terms", () => {
			const index = buildBM25Index([
				["auth", "login", "user"],
				["api", "endpoint", "rest"],
				["auth", "security"],
			]);

			const { score: authScore } = calculateBM25Score(["auth", "login", "user"], ["auth"], index);
			const { score: noMatchScore } = calculateBM25Score(["api", "endpoint"], ["auth"], index);

			expect(authScore).toBeGreaterThan(noMatchScore);
		});

		it("should return matched terms", () => {
			const index = buildBM25Index([["one", "two", "three"]]);
			const { matchedTerms } = calculateBM25Score(["one", "two", "three"], ["one", "three"], index);

			expect(matchedTerms).toContain("one");
			expect(matchedTerms).toContain("three");
			expect(matchedTerms).not.toContain("two");
		});
	});

	describe("searchBM25", () => {
		it("should return ranked results", () => {
			const documents = [
				{ item: "auth service", keywords: ["auth", "service", "login"] },
				{ item: "api handler", keywords: ["api", "handler", "rest"] },
				{ item: "auth middleware", keywords: ["auth", "middleware", "security"] },
			];

			const results = searchBM25(documents, ["auth", "security"], 10);

			expect(results.length).toBeGreaterThan(0);
			expect(results[0].document).toBe("auth middleware");
		});

		it("should return empty for no matches", () => {
			const documents = [
				{ item: "foo", keywords: ["foo", "bar"] },
			];

			const results = searchBM25(documents, ["nonexistent"], 10);
			expect(results).toHaveLength(0);
		});

		it("should respect limit parameter", () => {
			const documents = Array(20).fill(null).map((_, i) => ({
				item: `doc${i}`,
				keywords: ["common", `unique${i}`],
			}));

			const results = searchBM25(documents, ["common"], 5);
			expect(results.length).toBeLessThanOrEqual(5);
		});
	});

	describe("extractKeywords", () => {
		it("should extract meaningful words", () => {
			const keywords = extractKeywords("This is a test of the authentication system");

			// Note: BM25 applies stemming, so "authentication" becomes "authentica"
			expect(keywords.some((k) => k.startsWith("authentic"))).toBe(true);
			expect(keywords).toContain("system");
			expect(keywords).not.toContain("the");
			expect(keywords).not.toContain("is");
		});

		it("should handle empty input", () => {
			expect(extractKeywords("")).toEqual([]);
			expect(extractKeywords(null as any)).toEqual([]);
		});

		it("should apply basic stemming", () => {
			const keywords = extractKeywords("running tests testing");

			// Should stem 'running' to 'runn'
			expect(keywords.some((k) => k.startsWith("run"))).toBe(true);
		});
	});

	describe("extractFileKeywords", () => {
		it("should extract from file path", () => {
			const keywords = extractFileKeywords("src/services/AuthService.ts");

			expect(keywords).toContain("auth");
			expect(keywords).toContain("service");
			expect(keywords).toContain("services");
		});

		it("should handle camelCase and PascalCase", () => {
			const keywords = extractFileKeywords("UserAuthenticationHandler.ts");

			expect(keywords).toContain("user");
			expect(keywords).toContain("authentication");
			expect(keywords).toContain("handler");
		});
	});

	describe("extractCodeKeywords", () => {
		it("should extract function names", () => {
			const code = `
				function handleAuthentication() {}
				async function processUser() {}
			`;
			const keywords = extractCodeKeywords(code);

			expect(keywords).toContain("handle");
			expect(keywords).toContain("authentication");
			expect(keywords).toContain("process");
			expect(keywords).toContain("user");
		});

		it("should extract class names", () => {
			const code = `class UserService {}`;
			const keywords = extractCodeKeywords(code);

			expect(keywords).toContain("user");
			expect(keywords).toContain("service");
		});
	});

	describe("combineKeywords", () => {
		it("should combine and weight keywords", () => {
			const combined = combineKeywords([
				{ keywords: ["auth", "login"], weight: 2 },
				{ keywords: ["user", "auth"], weight: 1 },
			]);

			// auth should be first (weight 2 + 1 = 3)
			expect(combined[0]).toBe("auth");
		});
	});

	describe("keywordSimilarity", () => {
		it("should return 1 for identical sets", () => {
			expect(keywordSimilarity(["a", "b", "c"], ["a", "b", "c"])).toBe(1);
		});

		it("should return 0 for disjoint sets", () => {
			expect(keywordSimilarity(["a", "b"], ["c", "d"])).toBe(0);
		});

		it("should return partial similarity", () => {
			const sim = keywordSimilarity(["a", "b", "c"], ["a", "b", "d"]);
			expect(sim).toBeGreaterThan(0);
			expect(sim).toBeLessThan(1);
		});
	});
});
