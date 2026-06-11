import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * CLI COMMAND DISPATCH
 *
 * cli.test.ts focuses on `init` and `--help`. This file covers the command
 * router itself: unknown commands and the "missing required argument" guards
 * for every analysis subcommand. These are the offline, deterministic paths
 * (no git, no auth, no network) and they assert the exit codes a shell or CI
 * pipeline would actually branch on.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");
const CLI_PATH = join(projectRoot, "dist", "cli.js");

interface CliRun {
	status: number;
	output: string;
}

/** Run the built CLI with args; capture exit code + combined output. */
function runCli(args: string[]): CliRun {
	try {
		const output = execFileSync("node", [CLI_PATH, ...args], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
			// A throwaway cwd with no AI-tool config so nothing is auto-detected.
			cwd: projectRoot,
		});
		return { status: 0, output };
	} catch (err: any) {
		return {
			status: typeof err.status === "number" ? err.status : 1,
			output: `${err.stdout ?? ""}${err.stderr ?? ""}`,
		};
	}
}

describe("CLI Command Dispatch", () => {
	describe("unknown command", () => {
		it("exits non-zero and names the bad command", () => {
			const { status, output } = runCli(["definitely-not-a-command"]);
			expect(status).toBe(1);
			expect(output).toContain("Unknown command: definitely-not-a-command");
			expect(output).toContain("--help");
		});
	});

	describe("missing required arguments", () => {
		const subcommands: Array<{ cmd: string; usage: string }> = [
			{ cmd: "analyze", usage: "memoria analyze <file>" },
			{ cmd: "risk", usage: "memoria risk <file>" },
			{ cmd: "coupled", usage: "memoria coupled <file>" },
			{ cmd: "importers", usage: "memoria importers <file>" },
			{ cmd: "history", usage: "memoria history <query>" },
		];

		for (const { cmd, usage } of subcommands) {
			it(`${cmd} without an argument exits 1 with usage`, () => {
				const { status, output } = runCli([cmd]);
				expect(status).toBe(1);
				expect(output).toContain("Usage:");
				expect(output).toContain(usage);
			});
		}

		it("treats a lone flag as a missing positional argument", () => {
			// `analyze --json` has flags but no file path.
			const { status, output } = runCli(["analyze", "--json"]);
			expect(status).toBe(1);
			expect(output).toContain("Please provide a file path");
		});
	});

	describe("help", () => {
		it("lists the analysis subcommands", () => {
			const { status, output } = runCli(["--help"]);
			expect(status).toBe(0);
			// Help should document the primary commands a user can run.
			expect(output).toContain("analyze");
			expect(output).toContain("init");
			expect(output).toContain("doctor");
		});
	});

	describe("doctor", () => {
		// Runs inside this package's own git repo, so the diagnostic should
		// complete and report on each environment check.
		it("reports the environment checks", () => {
			const { output } = runCli(["doctor"]);
			expect(output).toContain("Memoria Doctor");
			expect(output).toContain("Node.js");
			expect(output).toContain("Git");
			expect(output).toContain("Sample analysis");
		});
	});
});
