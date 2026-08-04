import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = join(__dirname, "..", "..", "web");

/**
 * Static checks for the fail-closed INTERNAL_API_KEY pattern.
 * Full Next route tests need the web app runtime; these guard regressions.
 */
describe("INTERNAL_API_KEY fail-closed (web routes)", () => {
	it("scans/execute uses timing-safe compare and 503 when unset", () => {
		const src = readFileSync(
			join(webRoot, "src/app/api/scans/execute/route.ts"),
			"utf8",
		);
		expect(src).toContain("timingSafeEqual");
		expect(src).toContain("safeKeyEqual");
		expect(src).toContain("status: 503");
		expect(src).toContain("Server misconfigured");
		expect(src).not.toMatch(
			/INTERNAL_API_KEY\s*\|\|\s*["']memoria-internal["']/,
		);
	});

	it("callers refuse to fire when INTERNAL_API_KEY is missing", () => {
		for (const rel of [
			"src/app/api/onboarding/save-repos/route.ts",
			"src/app/api/repositories/[id]/scan/route.ts",
		]) {
			const src = readFileSync(join(webRoot, rel), "utf8");
			expect(src).toContain("INTERNAL_API_KEY is not configured");
			expect(src).not.toMatch(
				/INTERNAL_API_KEY\s*\|\|\s*["']memoria-internal["']/,
			);
		}
	});

	it("MCP CORS origin is configurable", () => {
		const src = readFileSync(join(webRoot, "src/app/api/mcp/route.ts"), "utf8");
		expect(src).toContain("MEMORIA_ALLOWED_ORIGIN");
	});
});
