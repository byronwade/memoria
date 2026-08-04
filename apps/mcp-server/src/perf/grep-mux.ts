import type { SimpleGit } from "simple-git";
import { grepThreadArgs } from "./pathspecs.js";

export interface MuxPattern {
	/** Stable id used to attribute hits (e.g. type name, endpoint). */
	id: string;
	/** Extended regex fragment (un-anchored ok). */
	pattern: string;
}

export interface MuxHit {
	file: string;
	ids: string[];
}

/**
 * Run a single `git grep -E` for many patterns and attribute matches back to
 * pattern ids. Falls back to per-pattern greps if the combined regex fails.
 */
export async function multiplexGrep(
	git: SimpleGit,
	patterns: MuxPattern[],
	pathspecs: string[],
	opts?: { threads?: number; maxFiles?: number },
): Promise<MuxHit[]> {
	if (patterns.length === 0) return [];

	const threads = opts?.threads ?? 4;
	const maxFiles = opts?.maxFiles ?? 80;
	const combined = patterns.map((p) => `(${p.pattern})`).join("|");

	try {
		const raw = await git
			.raw([
				"--no-optional-locks",
				"grep",
				...grepThreadArgs(threads),
				"-n",
				"-E",
				"--",
				combined,
				...pathspecs,
			])
			.catch(() => "");

		return attributeGrepLines(raw, patterns, maxFiles);
	} catch {
		// Fallback: sequential -l greps
		const fileIds = new Map<string, Set<string>>();
		for (const p of patterns) {
			const raw = await git
				.raw([
					"--no-optional-locks",
					"grep",
					"-l",
					"-E",
					"--",
					p.pattern,
					...pathspecs,
				])
				.catch(() => "");
			for (const line of raw.split("\n")) {
				const file = line.trim();
				if (!file) continue;
				if (!fileIds.has(file)) fileIds.set(file, new Set());
				fileIds.get(file)!.add(p.id);
			}
		}
		return [...fileIds.entries()]
			.slice(0, maxFiles)
			.map(([file, ids]) => ({ file, ids: [...ids] }));
	}
}

/** Parse `git grep -n` output and map lines to pattern ids via regex test. */
export function attributeGrepLines(
	raw: string,
	patterns: MuxPattern[],
	maxFiles: number,
): MuxHit[] {
	const fileIds = new Map<string, Set<string>>();
	const compiled = patterns.map((p) => ({
		id: p.id,
		re: new RegExp(p.pattern),
	}));

	for (const line of raw.split("\n")) {
		if (!line.trim()) continue;
		// format: path:line:content  (path may contain drive letters on Windows)
		const match = line.match(/^(.+?):(\d+):(.*)$/);
		if (!match) continue;
		const file = match[1];
		const content = match[3];
		for (const { id, re } of compiled) {
			if (re.test(content)) {
				if (!fileIds.has(file)) fileIds.set(file, new Set());
				fileIds.get(file)!.add(id);
			}
		}
		if (fileIds.size >= maxFiles) break;
	}

	return [...fileIds.entries()].map(([file, ids]) => ({
		file,
		ids: [...ids],
	}));
}
