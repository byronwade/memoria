import { describe, expect, it } from "vitest";
import {
	ANALYZE_FILE_OUTPUT_SCHEMA,
	buildStructuredAnalysis,
} from "../src/index.js";

/**
 * MCP structured tool output (2025-06-18): analyze_file returns typed
 * `structuredContent` matching ANALYZE_FILE_OUTPUT_SCHEMA alongside the markdown.
 * buildStructuredAnalysis maps the raw analysis result into that shape, emitting
 * forward-compatible fields (lift/support, hotspot/ownership) only when present.
 */
describe("structured tool output", () => {
	it("exposes a valid-looking output schema for analyze_file", () => {
		expect(ANALYZE_FILE_OUTPUT_SCHEMA.type).toBe("object");
		expect(ANALYZE_FILE_OUTPUT_SCHEMA.required).toContain("path");
		expect(ANALYZE_FILE_OUTPUT_SCHEMA.required).toContain("risk");
		expect(ANALYZE_FILE_OUTPUT_SCHEMA.properties.coupledFiles.type).toBe("array");
	});

	it("maps a full analysis (with optional signals) into typed output", () => {
		const analysis = {
			filePath: "/repo/src/foo.ts",
			volatility: {
				panicScore: 40,
				commitCount: 12,
				topAuthor: { name: "Dana", percentage: 88 },
				// forward-compatible (present once bugspots engine lands):
				hotspotScore: 2.5,
				bugFixCommits: 3,
				minorContributors: 4,
			},
			coupled: [
				{
					file: "bar.ts",
					score: 80,
					source: "git",
					lift: 4.2, // forward-compatible (lift engine)
					support: 8,
					evidence: { changeType: "schema" },
				},
				{ file: "README.md", score: 30, source: "docs" },
			],
			drift: [{ file: "baz.ts", daysOld: 12 }],
			importers: ["q.ts", "r.ts"],
			risk: { score: 65, level: "high", action: "Proceed carefully", factors: ["Volatile"] },
		} as any;

		const out = buildStructuredAnalysis(analysis);

		expect(out.path).toBe("/repo/src/foo.ts");
		expect(out.risk).toEqual({
			score: 65,
			level: "high",
			action: "Proceed carefully",
			factors: ["Volatile"],
		});
		// optional volatility signals present
		expect(out.volatility.hotspotScore).toBe(2.5);
		expect(out.volatility.bugFixCommits).toBe(3);
		expect(out.volatility.minorContributors).toBe(4);
		expect(out.volatility.topAuthor).toEqual({ name: "Dana", percentage: 88 });

		// coupling lift/support/relationship carried through
		const bar = out.coupledFiles.find((c) => c.file === "bar.ts")!;
		expect(bar.lift).toBe(4.2);
		expect(bar.support).toBe(8);
		expect(bar.relationship).toBe("schema");
		expect(bar.source).toBe("git");

		expect(out.staticDependents).toEqual(["q.ts", "r.ts"]);
		expect(out.drift).toEqual([{ file: "baz.ts", daysOld: 12 }]);
		// checklist: target + 2 coupled + 2 importers
		expect(out.preflightChecklist[0]).toContain("foo.ts");
		expect(out.preflightChecklist).toHaveLength(1 + 2 + 2);
	});

	it("omits optional fields when the engines don't provide them (back-compat)", () => {
		const analysis = {
			filePath: "/repo/src/old.ts",
			volatility: {
				panicScore: 5,
				commitCount: 3,
				topAuthor: null,
			},
			coupled: [{ file: "x.ts", score: 50, source: "git" }],
			drift: [],
			importers: [],
			risk: { score: 10, level: "low", action: "ok", factors: [] },
		} as any;

		const out = buildStructuredAnalysis(analysis);

		expect("hotspotScore" in out.volatility).toBe(false);
		expect("minorContributors" in out.volatility).toBe(false);
		expect(out.volatility.topAuthor).toBeNull();
		expect("lift" in out.coupledFiles[0]).toBe(false);
		expect("support" in out.coupledFiles[0]).toBe(false);
	});
});
