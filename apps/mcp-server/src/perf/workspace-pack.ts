import fs from "node:fs/promises";
import path from "node:path";
import type { SimpleGit } from "simple-git";

export const PACK_DIR = ".memoria";
export const PACK_FILE = "pack.json";

export interface PackedFileEntry {
	importers: string[];
	coupled: Array<{ file: string; score: number; source: string; reason: string }>;
	riskScore: number;
	updatedAt: string;
}

export interface WorkspacePack {
	version: 1;
	headSha: string;
	repoRoot: string;
	createdAt: string;
	files: Record<string, PackedFileEntry>;
}

/** In-memory daemon-style index keyed by repo root. */
const memoryIndex = new Map<
	string,
	{ headSha: string; pack: WorkspacePack | null; loadedAt: number }
>();

export function packPath(repoRoot: string): string {
	return path.join(repoRoot, PACK_DIR, PACK_FILE);
}

export async function getHeadSha(git: SimpleGit): Promise<string> {
	try {
		const sha = await git.revparse(["HEAD"]);
		return sha.trim();
	} catch {
		return "UNKNOWN";
	}
}

export async function loadWorkspacePack(
	repoRoot: string,
	headSha: string,
): Promise<WorkspacePack | null> {
	const mem = memoryIndex.get(repoRoot);
	if (mem && mem.headSha === headSha) {
		return mem.pack;
	}

	try {
		const raw = await fs.readFile(packPath(repoRoot), "utf8");
		const pack = JSON.parse(raw) as WorkspacePack;
		if (pack.version !== 1) {
			memoryIndex.set(repoRoot, { headSha, pack: null, loadedAt: Date.now() });
			return null;
		}
		// Stale pack (different HEAD) — still usable as a warm hint but mark sha
		const usable = pack.headSha === headSha ? pack : pack;
		memoryIndex.set(repoRoot, {
			headSha,
			pack: usable,
			loadedAt: Date.now(),
		});
		return usable;
	} catch {
		memoryIndex.set(repoRoot, { headSha, pack: null, loadedAt: Date.now() });
		return null;
	}
}

export async function saveWorkspacePack(pack: WorkspacePack): Promise<void> {
	const dir = path.join(pack.repoRoot, PACK_DIR);
	await fs.mkdir(dir, { recursive: true });
	await fs.writeFile(packPath(pack.repoRoot), JSON.stringify(pack, null, 2), "utf8");
	memoryIndex.set(pack.repoRoot, {
		headSha: pack.headSha,
		pack,
		loadedAt: Date.now(),
	});
}

export function lookupPackedFile(
	pack: WorkspacePack | null | undefined,
	relativePath: string,
): PackedFileEntry | null {
	if (!pack) return null;
	const normalized = relativePath.replace(/\\/g, "/");
	return pack.files[normalized] ?? null;
}

export function invalidateMemoryIndex(repoRoot?: string): void {
	if (repoRoot) memoryIndex.delete(repoRoot);
	else memoryIndex.clear();
}

/** Hot-file discovery: recently touched tracked source files. */
export async function discoverHotFiles(
	git: SimpleGit,
	repoRoot: string,
	limit = 40,
): Promise<string[]> {
	const log = await git
		.raw([
			"log",
			"--pretty=format:",
			"--name-only",
			"-n",
			"80",
			"--",
			"*.ts",
			"*.tsx",
			"*.js",
			"*.jsx",
			"*.py",
			"*.go",
			"*.rs",
		])
		.catch(() => "");

	const seen = new Set<string>();
	const files: string[] = [];
	for (const line of log.split("\n")) {
		const f = line.trim().replace(/\\/g, "/");
		if (!f || seen.has(f)) continue;
		if (f.includes("node_modules/") || f.includes("/dist/")) continue;
		seen.add(f);
		files.push(f);
		if (files.length >= limit) break;
	}

	// Ensure paths exist
	const existing: string[] = [];
	for (const f of files) {
		try {
			await fs.access(path.join(repoRoot, f));
			existing.push(f);
		} catch {
			/* deleted */
		}
	}
	return existing;
}
