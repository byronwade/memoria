import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["tests/**/*.test.ts"],
		// Tests importing from auto-librarian.js cause memory issues in Vitest's transformation pipeline
		// The module works correctly (tested via Node.js direct import)
		// Skip until Vitest/esbuild transformation issue is resolved
		exclude: [
			"tests/auto-librarian.test.ts",
			"tests/auto-save-memories.test.ts",
			"tests/memory-stress.test.ts",
		],
		// Increase timeout for git-based tests that can be slow
		testTimeout: 10000,
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			exclude: ["dist/**", "node_modules/**", "tests/**"],
		},
	},
});
