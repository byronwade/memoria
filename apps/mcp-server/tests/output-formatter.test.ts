import { beforeEach, describe, expect, it } from "vitest";
import type { DiffSummary } from "../src/index.js";

describe("Output Formatter (generateAiInstructions)", () => {
	let generateAiInstructions: (
		filePath: string,
		volatility: any,
		coupled: any[],
		drift: any[],
	) => string;

	beforeEach(async () => {
		const module = await import("../src/index.js");
		generateAiInstructions = module.generateAiInstructions;
	});

	// Helper to create a valid DiffSummary
	const createEvidence = (
		overrides: Partial<DiffSummary> = {},
	): DiffSummary => ({
		additions: [],
		removals: [],
		hunks: 0,
		netChange: 0,
		hasBreakingChange: false,
		changeType: "unknown",
		...overrides,
	});

	describe("Basic Structure", () => {
		it("should return a string", () => {
			const result = generateAiInstructions(
				"/path/to/file.ts",
				{
					commitCount: 10,
					panicScore: 0,
					authors: 1,
					lastCommitDate: "2024-01-01",
				},
				[],
				[],
			);

			expect(typeof result).toBe("string");
		});

		it("should include the filename in the header", () => {
			const result = generateAiInstructions(
				"/path/to/file.ts",
				{
					commitCount: 10,
					panicScore: 0,
					authors: 1,
					lastCommitDate: "2024-01-01",
				},
				[],
				[],
			);

			expect(result).toContain("file.ts");
			expect(result).toContain("Forensics:");
		});

		it("should include Pre-Flight Checklist section", () => {
			const result = generateAiInstructions(
				"/path/to/file.ts",
				{
					commitCount: 10,
					panicScore: 0,
					authors: 1,
					lastCommitDate: "2024-01-01",
				},
				[],
				[],
			);

			expect(result).toContain("Pre-flight Checklist");
		});

		it("should include compound risk score section", () => {
			const result = generateAiInstructions(
				"/path/to/file.ts",
				{
					commitCount: 10,
					panicScore: 0,
					authors: 1,
					lastCommitDate: "2024-01-01",
				},
				[],
				[],
			);

			expect(result).toContain("RISK:");
			expect(result).toContain("/100");
		});
	});

	describe("Section 1: Coupled Files", () => {
		it("should include coupled files section when coupled files exist", () => {
			const coupled = [
				{
					file: "utils.ts",
					score: 50,
					reason: "Refactored shared logic",
					lastHash: "abc1234",
					evidence: createEvidence({ changeType: "api" }),
				},
			];

			const result = generateAiInstructions(
				"/path/to/file.ts",
				{
					commitCount: 10,
					panicScore: 0,
					authors: 1,
					lastCommitDate: "2024-01-01",
				},
				coupled,
				[],
			);

			expect(result).toContain("Coupled Files");
		});

		it("should not include coupled files section when no coupled files", () => {
			const result = generateAiInstructions(
				"/path/to/file.ts",
				{
					commitCount: 10,
					panicScore: 0,
					authors: 1,
					lastCommitDate: "2024-01-01",
				},
				[],
				[],
			);

			expect(result).not.toContain("Coupled Files");
		});

		it("should include coupled file details with relationship type", () => {
			const coupled = [
				{
					file: "utils.ts",
					score: 50,
					reason: "Refactored shared logic",
					lastHash: "abc1234",
					evidence: createEvidence({ changeType: "schema" }),
				},
			];

			const result = generateAiInstructions(
				"/path/to/file.ts",
				{
					commitCount: 10,
					panicScore: 0,
					authors: 1,
					lastCommitDate: "2024-01-01",
				},
				coupled,
				[],
			);

			expect(result).toContain("utils.ts");
			expect(result).toContain("50%");
			expect(result).toContain("schema");
		});

		it("should include additions and removals when present", () => {
			const coupled = [
				{
					file: "utils.ts",
					score: 50,
					reason: "Refactored",
					lastHash: "abc1234",
					evidence: createEvidence({
						additions: ["const x = 1;", "const y = 2;"],
						removals: ["const old = 0;"],
						changeType: "api",
					}),
				},
			];

			const result = generateAiInstructions(
				"/path/to/file.ts",
				{
					commitCount: 10,
					panicScore: 0,
					authors: 1,
					lastCommitDate: "2024-01-01",
				},
				coupled,
				[],
			);

			expect(result).toContain("+ const x = 1;");
			expect(result).toContain("- const old = 0;");
		});

		it("should show breaking change warning when detected", () => {
			const coupled = [
				{
					file: "utils.ts",
					score: 50,
					reason: "Refactored",
					lastHash: "abc1234",
					evidence: createEvidence({
						hasBreakingChange: true,
						changeType: "api",
					}),
				},
			];

			const result = generateAiInstructions(
				"/path/to/file.ts",
				{
					commitCount: 10,
					panicScore: 0,
					authors: 1,
					lastCommitDate: "2024-01-01",
				},
				coupled,
				[],
			);

			expect(result).toContain("Breaking change detected");
		});
	});

	describe("Section 2: Pre-Flight Checklist", () => {
		it("should include markdown checkboxes", () => {
			const result = generateAiInstructions(
				"/path/to/file.ts",
				{
					commitCount: 10,
					panicScore: 0,
					authors: 1,
					lastCommitDate: "2024-01-01",
				},
				[],
				[],
			);

			expect(result).toContain("- [ ]");
		});

		it("should list primary file in checklist", () => {
			const result = generateAiInstructions(
				"/path/to/file.ts",
				{
					commitCount: 10,
					panicScore: 0,
					authors: 1,
					lastCommitDate: "2024-01-01",
				},
				[],
				[],
			);

			expect(result).toContain("Modify `file.ts`");
		});

		it("should list coupled files with relationship type", () => {
			const coupled = [
				{
					file: "utils.ts",
					score: 50,
					reason: "x",
					lastHash: "abc",
					evidence: createEvidence({ changeType: "schema" }),
				},
			];

			const result = generateAiInstructions(
				"/path/to/file.ts",
				{
					commitCount: 10,
					panicScore: 0,
					authors: 1,
					lastCommitDate: "2024-01-01",
				},
				coupled,
				[],
			);

			expect(result).toContain("Update `utils.ts`");
			expect(result).toContain("(schema)");
		});

		it("should list stale drift files with days", () => {
			const drift = [{ file: "old-file.ts", daysOld: 15 }];

			const result = generateAiInstructions(
				"/path/to/file.ts",
				{
					commitCount: 10,
					panicScore: 0,
					authors: 1,
					lastCommitDate: "2024-01-01",
				},
				[],
				drift,
			);

			expect(result).toContain("Update `old-file.ts`");
			expect(result).toContain("stale 15d");
		});
	});

	describe("Section 3: Compound Risk & Volatility", () => {
		it("should show NEW FILE for files with 0 commits", () => {
			const result = generateAiInstructions(
				"/path/to/file.ts",
				{
					commitCount: 0,
					panicScore: 0,
					authors: 0,
					lastCommitDate: undefined,
				},
				[],
				[],
			);

			expect(result).toContain("New file");
		});

		it("should show high volatility indicator when panicScore > 25", () => {
			const result = generateAiInstructions(
				"/path/to/file.ts",
				{
					commitCount: 10,
					panicScore: 50,
					authors: 1,
					lastCommitDate: "2024-01-01",
				},
				[],
				[],
			);

			// New format shows "Moderate churn" or "Volatile" status with panic score
			expect(result).toMatch(/Moderate churn|Volatile/);
			expect(result).toContain("50%");
		});

		it("should not show File History section when panicScore <= 25", () => {
			const result = generateAiInstructions(
				"/path/to/file.ts",
				{
					commitCount: 10,
					panicScore: 10,
					authors: 1,
					lastCommitDate: "2024-01-01",
				},
				[],
				[],
			);

			// New format hides File History section for stable files (panicScore <= 25)
			expect(result).not.toContain("File History");
		});

		it("should show File History section with expert when ownership > 70%", () => {
			// Create a full VolatilityResult with authorDetails and high ownership
			const volatility = {
				commitCount: 10,
				panicScore: 10, // Low panic score
				authors: 3,
				lastCommitDate: "2024-01-01",
				panicCommits: [],
				authorDetails: [
					{
						name: "Alice",
						email: "alice@test.com",
						commits: 8,
						percentage: 80,
						firstCommit: "2024-01-01",
						lastCommit: "2024-01-01",
					},
				],
				topAuthor: {
					name: "Alice",
					email: "alice@test.com",
					commits: 8,
					percentage: 80,
					firstCommit: "2024-01-01",
					lastCommit: "2024-01-01",
				},
				recencyDecay: {
					oldestCommitDays: 30,
					newestCommitDays: 1,
					decayFactor: 0.9,
				},
			};
			const result = generateAiInstructions(
				"/path/to/file.ts",
				volatility,
				[],
				[],
			);

			// New format shows File History section with Expert info when ownership >= 70%
			expect(result).toContain("File History");
			expect(result).toContain("Expert");
			expect(result).toContain("Alice");
		});

		it("should not include metadata for new files", () => {
			const result = generateAiInstructions(
				"/path/to/file.ts",
				{
					commitCount: 0,
					panicScore: 0,
					authors: 0,
					lastCommitDate: undefined,
				},
				[],
				[],
			);

			expect(result).not.toContain("Metadata:");
		});

		it("should include risk factors in compact format", () => {
			const result = generateAiInstructions(
				"/path/to/file.ts",
				{
					commitCount: 10,
					panicScore: 50,
					authors: 1,
					lastCommitDate: "2024-01-01",
				},
				[],
				[],
			);

			// New format shows risk factors compactly
			expect(result).toContain("volatility");
		});
	});

	describe("Markdown Formatting", () => {
		it("should use proper markdown headers", () => {
			const result = generateAiInstructions(
				"/path/to/file.ts",
				{
					commitCount: 10,
					panicScore: 0,
					authors: 1,
					lastCommitDate: "2024-01-01",
				},
				[],
				[],
			);

			// New format uses # and ## headers
			expect(result).toContain("#");
		});

		it("should use code formatting for file names", () => {
			const result = generateAiInstructions(
				"/path/to/file.ts",
				{
					commitCount: 10,
					panicScore: 0,
					authors: 1,
					lastCommitDate: "2024-01-01",
				},
				[],
				[],
			);

			expect(result).toContain("`file.ts`");
		});

		it("should include section dividers", () => {
			const result = generateAiInstructions(
				"/path/to/file.ts",
				{
					commitCount: 10,
					panicScore: 0,
					authors: 1,
					lastCommitDate: "2024-01-01",
				},
				[],
				[],
			);

			expect(result).toContain("---");
		});
	});

	describe("Relationship Instructions", () => {
		it("should include relationship-specific instructions for schema coupling", () => {
			const coupled = [
				{
					file: "types.ts",
					score: 75,
					reason: "Updated shared types",
					lastHash: "abc1234",
					evidence: createEvidence({ changeType: "schema" }),
				},
			];

			const result = generateAiInstructions(
				"/path/to/file.ts",
				{
					commitCount: 10,
					panicScore: 0,
					authors: 1,
					lastCommitDate: "2024-01-01",
				},
				coupled,
				[],
			);

			expect(result).toContain("type definitions");
		});

		it("should include relationship-specific instructions for api coupling", () => {
			const coupled = [
				{
					file: "service.ts",
					score: 60,
					reason: "Updated API",
					lastHash: "def5678",
					evidence: createEvidence({ changeType: "api" }),
				},
			];

			const result = generateAiInstructions(
				"/path/to/file.ts",
				{
					commitCount: 10,
					panicScore: 0,
					authors: 1,
					lastCommitDate: "2024-01-01",
				},
				coupled,
				[],
			);

			expect(result).toContain("API contract");
		});
	});
});
