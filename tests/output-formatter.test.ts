import { describe, it, expect, beforeEach } from "vitest";

describe("Output Formatter (generateAiInstructions)", () => {
	let generateAiInstructions: (
		filePath: string,
		volatility: any,
		coupled: any[],
		drift: any[]
	) => string;

	beforeEach(async () => {
		const module = await import("../src/index.js");
		generateAiInstructions = module.generateAiInstructions;
	});

	describe("Basic Structure", () => {
		it("should return a string", () => {
			const result = generateAiInstructions(
				"/path/to/file.ts",
				{ commitCount: 10, panicScore: 0, authors: 1, lastCommitDate: "2024-01-01" },
				[],
				[]
			);

			expect(typeof result).toBe("string");
		});

		it("should include the filename in the header", () => {
			const result = generateAiInstructions(
				"/path/to/file.ts",
				{ commitCount: 10, panicScore: 0, authors: 1, lastCommitDate: "2024-01-01" },
				[],
				[]
			);

			expect(result).toContain("file.ts");
			expect(result).toContain("Forensics for");
		});

		it("should include Pre-Flight Checklist section", () => {
			const result = generateAiInstructions(
				"/path/to/file.ts",
				{ commitCount: 10, panicScore: 0, authors: 1, lastCommitDate: "2024-01-01" },
				[],
				[]
			);

			expect(result).toContain("PRE-FLIGHT CHECKLIST");
		});

		it("should include Risk Assessment section", () => {
			const result = generateAiInstructions(
				"/path/to/file.ts",
				{ commitCount: 10, panicScore: 0, authors: 1, lastCommitDate: "2024-01-01" },
				[],
				[]
			);

			expect(result).toContain("RISK ASSESSMENT");
		});
	});

	describe("Section 1: Detective Work", () => {
		it("should include Detective Work section when coupled files exist", () => {
			const coupled = [
				{
					file: "utils.ts",
					score: 50,
					reason: "Refactored shared logic",
					lastHash: "abc1234",
					evidence: "diff content here",
				},
			];

			const result = generateAiInstructions(
				"/path/to/file.ts",
				{ commitCount: 10, panicScore: 0, authors: 1, lastCommitDate: "2024-01-01" },
				coupled,
				[]
			);

			expect(result).toContain("DETECTIVE WORK REQUIRED");
		});

		it("should not include Detective Work section when no coupled files", () => {
			const result = generateAiInstructions(
				"/path/to/file.ts",
				{ commitCount: 10, panicScore: 0, authors: 1, lastCommitDate: "2024-01-01" },
				[],
				[]
			);

			expect(result).not.toContain("DETECTIVE WORK REQUIRED");
		});

		it("should include coupled file details", () => {
			const coupled = [
				{
					file: "utils.ts",
					score: 50,
					reason: "Refactored shared logic",
					lastHash: "abc1234",
					evidence: "some diff content",
				},
			];

			const result = generateAiInstructions(
				"/path/to/file.ts",
				{ commitCount: 10, panicScore: 0, authors: 1, lastCommitDate: "2024-01-01" },
				coupled,
				[]
			);

			expect(result).toContain("utils.ts");
			expect(result).toContain("50% coupled");
			expect(result).toContain("Refactored shared logic");
		});

		it("should include evidence in code blocks when available", () => {
			const coupled = [
				{
					file: "utils.ts",
					score: 50,
					reason: "Refactored",
					lastHash: "abc1234",
					evidence: "const x = 1;",
				},
			];

			const result = generateAiInstructions(
				"/path/to/file.ts",
				{ commitCount: 10, panicScore: 0, authors: 1, lastCommitDate: "2024-01-01" },
				coupled,
				[]
			);

			expect(result).toContain("```");
			expect(result).toContain("const x = 1;");
		});

		it("should handle coupled files without evidence", () => {
			const coupled = [
				{
					file: "utils.ts",
					score: 50,
					reason: "Refactored",
					lastHash: "abc1234",
					evidence: "",
				},
			];

			const result = generateAiInstructions(
				"/path/to/file.ts",
				{ commitCount: 10, panicScore: 0, authors: 1, lastCommitDate: "2024-01-01" },
				coupled,
				[]
			);

			expect(result).toContain("historically change together");
		});
	});

	describe("Section 2: Pre-Flight Checklist", () => {
		it("should include markdown checkboxes", () => {
			const result = generateAiInstructions(
				"/path/to/file.ts",
				{ commitCount: 10, panicScore: 0, authors: 1, lastCommitDate: "2024-01-01" },
				[],
				[]
			);

			expect(result).toContain("- [ ]");
		});

		it("should list primary file in checklist", () => {
			const result = generateAiInstructions(
				"/path/to/file.ts",
				{ commitCount: 10, panicScore: 0, authors: 1, lastCommitDate: "2024-01-01" },
				[],
				[]
			);

			expect(result).toContain("Modify `file.ts`");
			expect(result).toContain("primary target");
		});

		it("should list coupled files with percentages", () => {
			const coupled = [
				{ file: "utils.ts", score: 50, reason: "x", lastHash: "abc", evidence: "" },
			];

			const result = generateAiInstructions(
				"/path/to/file.ts",
				{ commitCount: 10, panicScore: 0, authors: 1, lastCommitDate: "2024-01-01" },
				coupled,
				[]
			);

			expect(result).toContain("Verify/update `utils.ts`");
			expect(result).toContain("50% coupling");
		});

		it("should list stale drift files with days", () => {
			const drift = [{ file: "old-file.ts", daysOld: 15 }];

			const result = generateAiInstructions(
				"/path/to/file.ts",
				{ commitCount: 10, panicScore: 0, authors: 1, lastCommitDate: "2024-01-01" },
				[],
				drift
			);

			expect(result).toContain("Update `old-file.ts`");
			expect(result).toContain("stale by 15 days");
		});
	});

	describe("Section 3: Risk Assessment", () => {
		it("should show NEW status for files with 0 commits", () => {
			const result = generateAiInstructions(
				"/path/to/file.ts",
				{ commitCount: 0, panicScore: 0, authors: 0, lastCommitDate: undefined },
				[],
				[]
			);

			expect(result).toContain("NEW/UNTRACKED FILE");
		});

		it("should show VOLATILE status when panicScore > 25", () => {
			const result = generateAiInstructions(
				"/path/to/file.ts",
				{ commitCount: 10, panicScore: 50, authors: 1, lastCommitDate: "2024-01-01" },
				[],
				[]
			);

			expect(result).toContain("VOLATILE");
			expect(result).toContain("50% Panic Score");
		});

		it("should show STABLE status when panicScore <= 25", () => {
			const result = generateAiInstructions(
				"/path/to/file.ts",
				{ commitCount: 10, panicScore: 10, authors: 1, lastCommitDate: "2024-01-01" },
				[],
				[]
			);

			expect(result).toContain("STABLE");
		});

		it("should include metadata for files with commits", () => {
			const result = generateAiInstructions(
				"/path/to/file.ts",
				{ commitCount: 10, panicScore: 0, authors: 3, lastCommitDate: "2024-01-01" },
				[],
				[]
			);

			expect(result).toContain("Total commits analyzed: 10");
			expect(result).toContain("Unique contributors: 3");
			expect(result).toContain("Last modified: 2024-01-01");
		});

		it("should not include metadata for new files", () => {
			const result = generateAiInstructions(
				"/path/to/file.ts",
				{ commitCount: 0, panicScore: 0, authors: 0, lastCommitDate: undefined },
				[],
				[]
			);

			expect(result).not.toContain("Total commits analyzed");
		});

		it("should include warning for volatile files", () => {
			const result = generateAiInstructions(
				"/path/to/file.ts",
				{ commitCount: 10, panicScore: 50, authors: 1, lastCommitDate: "2024-01-01" },
				[],
				[]
			);

			expect(result).toContain("historically fragile");
			expect(result).toContain("Required Action");
		});
	});

	describe("Markdown Formatting", () => {
		it("should use proper markdown headers", () => {
			const result = generateAiInstructions(
				"/path/to/file.ts",
				{ commitCount: 10, panicScore: 0, authors: 1, lastCommitDate: "2024-01-01" },
				[],
				[]
			);

			expect(result).toContain("###");
		});

		it("should use code formatting for file names", () => {
			const result = generateAiInstructions(
				"/path/to/file.ts",
				{ commitCount: 10, panicScore: 0, authors: 1, lastCommitDate: "2024-01-01" },
				[],
				[]
			);

			expect(result).toContain("`file.ts`");
		});

		it("should include section dividers", () => {
			const result = generateAiInstructions(
				"/path/to/file.ts",
				{ commitCount: 10, panicScore: 0, authors: 1, lastCommitDate: "2024-01-01" },
				[],
				[]
			);

			expect(result).toContain("---");
		});
	});
});
