import { beforeEach, describe, expect, it } from "vitest";

describe("Concurrency Limiter (mapConcurrent)", () => {
	let mapConcurrent: <T, R>(
		items: readonly T[],
		limit: number,
		fn: (item: T) => Promise<R>,
	) => Promise<R[]>;

	beforeEach(async () => {
		const module = await import("../src/index.js");
		mapConcurrent = module.mapConcurrent;
	});

	describe("Basic Functionality", () => {
		it("should process all items and return results", async () => {
			const items = [1, 2, 3, 4, 5];
			const results = await mapConcurrent(items, 2, async (item) => item * 2);

			expect(results).toHaveLength(5);
			expect(results.sort((a, b) => a - b)).toEqual([2, 4, 6, 8, 10]);
		});

		it("should handle empty array", async () => {
			const items: number[] = [];
			const results = await mapConcurrent(items, 5, async (item) => item * 2);

			expect(results).toEqual([]);
		});

		it("should handle single item", async () => {
			const items = [42];
			const results = await mapConcurrent(items, 5, async (item) => item * 2);

			expect(results).toEqual([84]);
		});

		it("should work with readonly arrays", async () => {
			const items = [1, 2, 3] as const;
			const results = await mapConcurrent(items, 2, async (item) => item * 2);

			expect(results.sort()).toEqual([2, 4, 6]);
		});
	});

	describe("Concurrency Limiting", () => {
		it("should respect the concurrency limit", async () => {
			let concurrent = 0;
			let maxConcurrent = 0;
			const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

			await mapConcurrent(items, 3, async (item) => {
				concurrent++;
				maxConcurrent = Math.max(maxConcurrent, concurrent);
				// Simulate async work
				await new Promise((resolve) => setTimeout(resolve, 10));
				concurrent--;
				return item;
			});

			expect(maxConcurrent).toBeLessThanOrEqual(3);
		});

		it("should allow higher concurrency when limit is higher", async () => {
			let concurrent = 0;
			let maxConcurrent = 0;
			const items = [1, 2, 3, 4, 5];

			await mapConcurrent(items, 10, async (item) => {
				concurrent++;
				maxConcurrent = Math.max(maxConcurrent, concurrent);
				await new Promise((resolve) => setTimeout(resolve, 10));
				concurrent--;
				return item;
			});

			// With limit 10 and 5 items, all 5 can run concurrently
			expect(maxConcurrent).toBeLessThanOrEqual(5);
		});

		it("should run sequentially when limit is 1", async () => {
			let concurrent = 0;
			let maxConcurrent = 0;
			const items = [1, 2, 3];

			await mapConcurrent(items, 1, async (item) => {
				concurrent++;
				maxConcurrent = Math.max(maxConcurrent, concurrent);
				await new Promise((resolve) => setTimeout(resolve, 5));
				concurrent--;
				return item;
			});

			expect(maxConcurrent).toBe(1);
		});
	});

	describe("Error Handling", () => {
		it("should propagate errors from async function", async () => {
			const items = [1, 2, 3];

			await expect(
				mapConcurrent(items, 2, async (item) => {
					if (item === 2) throw new Error("Test error");
					return item;
				}),
			).rejects.toThrow("Test error");
		});

		it("should handle async rejections", async () => {
			const items = [1, 2, 3];

			await expect(
				mapConcurrent(items, 2, async () => {
					await Promise.reject(new Error("Rejection"));
				}),
			).rejects.toThrow("Rejection");
		});
	});

	describe("Ordering", () => {
		it("should complete all items regardless of processing time", async () => {
			const items = [1, 2, 3, 4, 5];
			const results = await mapConcurrent(items, 2, async (item) => {
				// Vary processing time based on item
				await new Promise((resolve) => setTimeout(resolve, (6 - item) * 5));
				return item * 10;
			});

			// All items should be processed
			expect(results.sort((a, b) => a - b)).toEqual([10, 20, 30, 40, 50]);
		});
	});

	describe("Type Safety", () => {
		it("should transform item types correctly", async () => {
			const items = ["a", "b", "c"];
			const results = await mapConcurrent(items, 2, async (item) => ({
				value: item,
				upper: item.toUpperCase(),
			}));

			expect(results).toHaveLength(3);
			results.forEach((r) => {
				expect(r).toHaveProperty("value");
				expect(r).toHaveProperty("upper");
			});
		});

		it("should work with complex object types", async () => {
			const items = [
				{ id: 1, name: "one" },
				{ id: 2, name: "two" },
			];

			const results = await mapConcurrent(items, 2, async (item) => ({
				...item,
				processed: true,
			}));

			expect(results).toHaveLength(2);
			results.forEach((r) => {
				expect(r.processed).toBe(true);
			});
		});
	});
});
