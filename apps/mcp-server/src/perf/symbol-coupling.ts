import fs from "node:fs/promises";
import path from "node:path";
import type { SimpleGit } from "simple-git";
import { codeGrepPathspecs, grepThreadArgs } from "./pathspecs.js";

export interface SymbolHit {
	file: string;
	score: number;
	source: "symbol";
	reason: string;
	confidence: number;
}

/**
 * Extract exported symbol names from source (lightweight, language-agnostic).
 */
export function extractSymbols(sourceCode: string, limit = 20): string[] {
	const names = new Set<string>();
	const patterns = [
		/export\s+(?:async\s+)?function\s+([A-Za-z_][\w]*)/g,
		/export\s+(?:const|let|var)\s+([A-Za-z_][\w]*)/g,
		/export\s+(?:type|interface|class|enum)\s+([A-Za-z_][\w]*)/g,
		/export\s+\{\s*([^}]+)\}/g,
		/^def\s+([A-Za-z_][\w]*)/gm,
		/^func\s+\(?.*?\)?\s*([A-Za-z_][\w]*)\s*\(/gm,
		/^pub\s+(?:async\s+)?fn\s+([A-Za-z_][\w]*)/gm,
	];

	for (const re of patterns) {
		let match: RegExpExecArray | null;
		while ((match = re.exec(sourceCode)) !== null) {
			if (re.source.includes("\\{")) {
				// export { a, b as c }
				for (const part of match[1].split(",")) {
					const name = part.trim().split(/\s+as\s+/).pop()?.trim();
					if (name && /^[A-Za-z_][\w]*$/.test(name)) names.add(name);
				}
			} else if (match[1]) {
				names.add(match[1]);
			}
		}
	}

	return [...names].slice(0, limit);
}

/**
 * Find files that reference a specific symbol (or top exports of the target).
 */
export async function getSymbolCoupling(opts: {
	git: SimpleGit;
	repoRoot: string;
	filePath: string;
	sourceContent: string;
	symbol?: string;
	relativePath: string;
}): Promise<SymbolHit[]> {
	const symbols = opts.symbol
		? [opts.symbol]
		: extractSymbols(opts.sourceContent, 8);

	if (symbols.length === 0) return [];

	const pattern = symbols
		.map((s) => `\\b${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`)
		.join("|");

	const raw = await opts.git
		.raw([
			"--no-optional-locks",
			"grep",
			...grepThreadArgs(4),
			"-l",
			"-E",
			"--",
			pattern,
			...codeGrepPathspecs({ includeTests: true }),
		])
		.catch(() => "");

	const files = raw
		.split("\n")
		.map((f) => f.trim())
		.filter((f) => f && f.replace(/\\/g, "/") !== opts.relativePath.replace(/\\/g, "/"))
		.slice(0, 30);

	const hits: SymbolHit[] = [];
	for (const file of files) {
		const content = await fs
			.readFile(path.join(opts.repoRoot, file), "utf8")
			.catch(() => "");
		const matched = symbols.filter((s) =>
			new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(content),
		);
		if (matched.length === 0) continue;

		// Prefer import-like usage for confidence
		const importLike = matched.some((s) =>
			new RegExp(
				`(import|from|require|use\\s+|from\\s+).*\\b${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
			).test(content),
		);

		hits.push({
			file,
			score: Math.min(80, 40 + matched.length * 10),
			source: "symbol",
			reason: `References symbol${matched.length > 1 ? "s" : ""}: ${matched.slice(0, 3).join(", ")}`,
			confidence: importLike ? 0.85 : 0.55,
		});
	}

	hits.sort((a, b) => b.score - a.score);
	return hits.slice(0, 5);
}
