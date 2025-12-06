import { describe, it, expect } from "vitest";
import {
	formatContextResponse,
	formatMinimalResponse,
	formatSaveLessonResponse,
	buildRiskAssessment,
} from "../src/context-response.js";

describe("Context Response Formatter", () => {
	describe("buildRiskAssessment", () => {
		it("should calculate LOW risk for stable files", () => {
			const result = buildRiskAssessment(10, 1, 2, 0);

			expect(result.level).toBe("low");
			expect(result.score).toBeLessThan(25);
		});

		it("should calculate HIGH risk for volatile files", () => {
			const result = buildRiskAssessment(70, 5, 10, 2);

			expect(result.level).toBe("high");
			expect(result.score).toBeGreaterThanOrEqual(50);
		});

		it("should calculate CRITICAL risk for very risky files", () => {
			const result = buildRiskAssessment(90, 8, 15, 3);

			expect(result.level).toBe("critical");
			expect(result.score).toBeGreaterThanOrEqual(75);
		});

		it("should include relevant factors", () => {
			const result = buildRiskAssessment(60, 5, 8, 1);

			expect(result.factors.length).toBeGreaterThan(0);
			expect(result.factors.some((f) => f.includes("volatility"))).toBe(true);
		});

		it("should report tight coupling", () => {
			const result = buildRiskAssessment(10, 5, 2, 0);

			expect(result.factors.some((f) => f.includes("coupled"))).toBe(true);
		});

		it("should report heavy imports", () => {
			const result = buildRiskAssessment(10, 1, 10, 0);

			expect(result.factors.some((f) => f.includes("imported"))).toBe(true);
		});
	});

	describe("formatMinimalResponse", () => {
		it("should format low-risk file response", () => {
			const response = formatMinimalResponse("/src/utils.ts", 15);

			expect(response).toContain("utils.ts");
			expect(response).toContain("15/100");
			expect(response).toContain("LOW");
			expect(response).toContain("Safe to proceed");
		});
	});

	describe("formatSaveLessonResponse", () => {
		it("should format success response", () => {
			const response = formatSaveLessonResponse(true, "mem_123");

			expect(response).toContain("saved successfully");
			expect(response).toContain("mem_123");
		});

		it("should format error response", () => {
			const response = formatSaveLessonResponse(false, undefined, "Network error");

			expect(response).toContain("Failed");
			expect(response).toContain("Network error");
		});
	});

	describe("formatContextResponse", () => {
		it("should format complete context response", () => {
			const response = formatContextResponse({
				filePath: "/src/auth/service.ts",
				memories: [
					{
						_id: "1",
						context: "Security critical",
						summary: "Handle authentication carefully",
						tags: ["security", "auth"],
						linkedFiles: ["/src/auth/service.ts"],
						importance: "critical",
						memoryType: "warning",
						createdAt: Date.now(),
					},
				],
				relationships: [
					{
						type: "co_changes",
						strength: 45,
						targetFile: { path: "/src/auth/types.ts", riskScore: 30 },
					},
				],
				recentCommits: [],
				riskAssessment: {
					score: 65,
					level: "high",
					factors: ["High volatility", "Tightly coupled"],
				},
			});

			expect(response).toContain("service.ts");
			expect(response).toContain("65/100");
			expect(response).toContain("HIGH");
			expect(response).toContain("CRITICAL MEMORIES");
			expect(response).toContain("Handle authentication");
		});

		it("should include code graph for coupled files", () => {
			const response = formatContextResponse({
				filePath: "/src/api.ts",
				memories: [],
				relationships: [
					{
						type: "co_changes",
						strength: 50,
						targetFile: { path: "/src/types.ts", riskScore: 20 },
					},
					{
						type: "imports",
						strength: 100,
						targetFile: { path: "/src/utils.ts", riskScore: 10 },
					},
				],
				recentCommits: [],
				riskAssessment: {
					score: 30,
					level: "medium",
					factors: [],
				},
			});

			expect(response).toContain("CODE GRAPH");
			expect(response).toContain("Co-changed files");
		});

		it("should include pre-flight checklist", () => {
			const response = formatContextResponse({
				filePath: "/src/service.ts",
				memories: [],
				relationships: [
					{
						type: "co_changes",
						strength: 40,
						targetFile: { path: "/src/related.ts", riskScore: 25 },
					},
				],
				recentCommits: [],
				riskAssessment: {
					score: 35,
					level: "medium",
					factors: [],
				},
			});

			expect(response).toContain("PRE-FLIGHT CHECKLIST");
			expect(response).toContain("service.ts");
			expect(response).toContain("related.ts");
		});
	});
});
