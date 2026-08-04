import path from "node:path";
import type { SimpleGit } from "simple-git";

/**
 * List files changed between a base ref and HEAD (name-only).
 */
export async function listChangedFiles(
	git: SimpleGit,
	diffBase: string,
	opts?: { maxFiles?: number },
): Promise<string[]> {
	const maxFiles = opts?.maxFiles ?? 40;
	const raw = await git
		.raw([
			"diff",
			"--name-only",
			"--diff-filter=ACMR",
			`${diffBase}...HEAD`,
		])
		.catch(async () =>
			// Fallback when triple-dot fails (shallow / missing base)
			git.raw(["diff", "--name-only", "--diff-filter=ACMR", diffBase]).catch(() => ""),
		);

	const files = raw
		.split("\n")
		.map((f) => f.trim().replace(/\\/g, "/"))
		.filter((f) => f && !f.includes("node_modules/") && !/\.(md|lock)$/i.test(f));

	return [...new Set(files)].slice(0, maxFiles);
}

export function toAbsolutePaths(repoRoot: string, relativeFiles: string[]): string[] {
	return relativeFiles.map((f) => path.join(repoRoot, f));
}
