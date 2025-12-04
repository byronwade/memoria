import { describe, it, expect, beforeEach } from "vitest";
import { LRUCache } from "lru-cache";

describe("Cache Behavior", () => {
	let cache: LRUCache<string, any>;

	beforeEach(() => {
		// Same config as src/index.ts
		cache = new LRUCache<string, any>({ max: 100, ttl: 1000 * 60 * 5 });
	});

	describe("Basic Operations", () => {
		it("should store and retrieve values", () => {
			cache.set("test:key", { data: "value" });
			expect(cache.get("test:key")).toEqual({ data: "value" });
		});

		it("should return undefined for missing keys", () => {
			expect(cache.get("non-existent")).toBeUndefined();
		});

		it("should check key existence with has()", () => {
			cache.set("exists", true);
			expect(cache.has("exists")).toBe(true);
			expect(cache.has("not-exists")).toBe(false);
		});
	});

	describe("LRU Eviction", () => {
		it("should respect max size of 100", () => {
			// Fill cache beyond max
			for (let i = 0; i < 150; i++) {
				cache.set(`key:${i}`, i);
			}

			// First 50 items should be evicted
			expect(cache.has("key:0")).toBe(false);
			expect(cache.has("key:49")).toBe(false);

			// Last 100 items should exist
			expect(cache.has("key:50")).toBe(true);
			expect(cache.has("key:149")).toBe(true);
		});

		it("should evict items when exceeding max capacity", () => {
			// Fill cache exactly to max
			for (let i = 0; i < 100; i++) {
				cache.set(`key:${i}`, i);
			}

			expect(cache.size).toBe(100);

			// Add one more item to trigger eviction
			cache.set("new-key", "new-value");

			// Cache should still be at max capacity
			expect(cache.size).toBeLessThanOrEqual(100);

			// The new key should exist
			expect(cache.has("new-key")).toBe(true);

			// At least one old key should be evicted
			expect(cache.has("key:0")).toBe(false);
		});
	});

	describe("TTL Configuration", () => {
		it("should create cache with 5-minute TTL", () => {
			const cacheWithTTL = new LRUCache<string, any>({ max: 100, ttl: 1000 * 60 * 5 });
			cacheWithTTL.set("test", "value");

			// Verify the cache was created and accepts values
			expect(cacheWithTTL.has("test")).toBe(true);
			expect(cacheWithTTL.get("test")).toBe("value");
		});

		it("should expire entries after TTL (integration test)", async () => {
			// Create a cache with very short TTL for testing
			const shortCache = new LRUCache<string, any>({ max: 100, ttl: 100 }); // 100ms
			shortCache.set("expires", "value");

			expect(shortCache.has("expires")).toBe(true);

			// Wait for TTL to expire
			await new Promise((resolve) => setTimeout(resolve, 150));

			// Entry should be expired
			expect(shortCache.has("expires")).toBe(false);
		});

		it("should not expire entries within TTL window", async () => {
			const shortCache = new LRUCache<string, any>({ max: 100, ttl: 200 }); // 200ms
			shortCache.set("valid", "value");

			// Wait 50ms (well within TTL)
			await new Promise((resolve) => setTimeout(resolve, 50));

			expect(shortCache.has("valid")).toBe(true);
			expect(shortCache.get("valid")).toBe("value");
		});
	});

	describe("Cache Key Namespacing", () => {
		it("should support different namespaces for different engines", () => {
			const filePath = "/project/src/index.ts";

			cache.set(`coupling:${filePath}`, { coupled: ["file1.ts"] });
			cache.set(`volatility:${filePath}`, { score: 25 });
			cache.set(`gitignore:/project`, { patterns: [".git/"] });

			expect(cache.get(`coupling:${filePath}`)).toEqual({ coupled: ["file1.ts"] });
			expect(cache.get(`volatility:${filePath}`)).toEqual({ score: 25 });
			expect(cache.get(`gitignore:/project`)).toEqual({ patterns: [".git/"] });
		});

		it("should treat different file paths as different cache entries", () => {
			cache.set("coupling:/project/src/a.ts", "data-a");
			cache.set("coupling:/project/src/b.ts", "data-b");

			expect(cache.get("coupling:/project/src/a.ts")).toBe("data-a");
			expect(cache.get("coupling:/project/src/b.ts")).toBe("data-b");
		});
	});

	describe("Performance", () => {
		it("should handle rapid reads efficiently", () => {
			cache.set("hot-key", { data: "frequently accessed" });

			const start = performance.now();
			for (let i = 0; i < 10000; i++) {
				cache.get("hot-key");
			}
			const duration = performance.now() - start;

			// Should complete 10k reads in under 100ms
			expect(duration).toBeLessThan(100);
		});

		it("should handle many unique keys", () => {
			const start = performance.now();

			for (let i = 0; i < 100; i++) {
				cache.set(`file:${i}`, { data: i });
			}

			const duration = performance.now() - start;

			// Should complete 100 writes in under 50ms
			expect(duration).toBeLessThan(50);
			expect(cache.size).toBe(100);
		});
	});
});
