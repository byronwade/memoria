/**
 * Call-graph style symbol references.
 * Uses the TypeScript compiler API when available; falls back to regex.
 */

import fs from "node:fs/promises";
import path from "node:path";

export interface CallGraphHit {
	file: string;
	symbols: string[];
	score: number;
	source: "symbol";
	reason: string;
	confidence: number;
}

async function tryLoadTypescript(): Promise<typeof import("typescript") | null> {
	try {
		return await import("typescript");
	} catch {
		return null;
	}
}

/**
 * Find files that reference exported symbols using TS AST when possible.
 */
export async function findSymbolReferences(opts: {
	repoRoot: string;
	filePath: string;
	sourceContent: string;
	symbols: string[];
	candidateFiles: string[];
}): Promise<CallGraphHit[]> {
	if (opts.symbols.length === 0 || opts.candidateFiles.length === 0) return [];

	const ts = await tryLoadTypescript();
	const hits: CallGraphHit[] = [];

	for (const rel of opts.candidateFiles.slice(0, 40)) {
		const abs = path.isAbsolute(rel) ? rel : path.join(opts.repoRoot, rel);
		if (abs === opts.filePath) continue;
		const content = await fs.readFile(abs, "utf8").catch(() => "");
		if (!content) continue;

		let matched: string[] = [];
		if (ts && /\.[jt]sx?$/.test(abs)) {
			matched = matchSymbolsWithTs(ts, content, opts.symbols);
		} else {
			matched = opts.symbols.filter((s) =>
				new RegExp(`\\b${escapeRe(s)}\\b`).test(content),
			);
		}
		if (matched.length === 0) continue;

		const importLike = matched.some((s) =>
			new RegExp(
				`(import|from|require).*\\b${escapeRe(s)}\\b`,
			).test(content),
		);

		hits.push({
			file: path.relative(opts.repoRoot, abs).replace(/\\/g, "/"),
			symbols: matched,
			score: Math.min(85, 45 + matched.length * 12),
			source: "symbol",
			reason: `References: ${matched.slice(0, 3).join(", ")}`,
			confidence: importLike ? 0.9 : ts ? 0.75 : 0.55,
		});
	}

	hits.sort((a, b) => b.score - a.score);
	return hits.slice(0, 5);
}

function matchSymbolsWithTs(
	ts: typeof import("typescript"),
	source: string,
	symbols: string[],
): string[] {
	const want = new Set(symbols);
	const found = new Set<string>();
	const sf = ts.createSourceFile(
		"file.ts",
		source,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TSX,
	);

	const visit = (node: import("typescript").Node) => {
		if (ts.isIdentifier(node) && want.has(node.text)) {
			found.add(node.text);
		}
		ts.forEachChild(node, visit);
	};
	visit(sf);
	return [...found];
}

function escapeRe(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
