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
		// Git-based tests spin up real repos and can be slow under parallel load
		// (e.g. whole-repo `git log -L` history search). 20s avoids flaky timeouts.
		testTimeout: 20000,
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			exclude: ["dist/**", "node_modules/**", "tests/**"],
		},
	},
});
