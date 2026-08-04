import fs from "node:fs/promises";
import path from "node:path";
import simpleGit from "simple-git";
import { getHeadSha, packPath } from "./workspace-pack.js";

export interface WatchOptions {
	repoRoot: string;
	intervalMs?: number;
	/** Called when HEAD changes; should rebuild/save the pack and return file count. */
	refreshPack: () => Promise<number>;
	onUpdate?: (info: { headSha: string; packed: number }) => void;
	onError?: (err: unknown) => void;
}

/**
 * Poll HEAD and refresh the workspace pack when it changes.
 * Returns a stop() function.
 */
export function startPackWatch(opts: WatchOptions): { stop: () => void } {
	const intervalMs = opts.intervalMs ?? 5000;
	const git = simpleGit(opts.repoRoot);
	let lastSha = "";
	let stopped = false;
	let running = false;

	const tick = async () => {
		if (stopped || running) return;
		running = true;
		try {
			const sha = await getHeadSha(git);
			if (sha && sha !== lastSha && sha !== "UNKNOWN") {
				lastSha = sha;
				const packed = await opts.refreshPack();
				opts.onUpdate?.({ headSha: sha, packed });
			}
		} catch (err) {
			opts.onError?.(err);
		} finally {
			running = false;
		}
	};

	void tick();
	const timer = setInterval(() => void tick(), intervalMs);
	if (typeof timer.unref === "function") timer.unref();

	return {
		stop: () => {
			stopped = true;
			clearInterval(timer);
		},
	};
}

/** Install a post-commit hook that runs `memoria pack --limit=20`. */
export async function installPostCommitHook(repoRoot: string): Promise<string> {
	const hookDir = path.join(repoRoot, ".git", "hooks");
	const hookPath = path.join(hookDir, "post-commit");
	await fs.mkdir(hookDir, { recursive: true });

	const marker = "# memoria-pack-hook";
	const snippet = `#!/bin/sh
${marker}
# Refresh Memoria workspace pack after each commit (best-effort, non-blocking)
if command -v memoria >/dev/null 2>&1; then
  (memoria pack --limit=20 --json >/dev/null 2>&1 &)
elif command -v npx >/dev/null 2>&1; then
  (npx -y @byronwade/memoria pack --limit=20 --json >/dev/null 2>&1 &)
fi
`;

	let existing = "";
	try {
		existing = await fs.readFile(hookPath, "utf8");
	} catch {
		/* new */
	}

	if (existing.includes(marker)) {
		return hookPath;
	}

	const content = existing ? `${existing.trimEnd()}\n\n${snippet}` : snippet;
	await fs.writeFile(hookPath, content, { mode: 0o755 });
	await fs.chmod(hookPath, 0o755).catch(() => undefined);
	return hookPath;
}

export async function packExists(repoRoot: string): Promise<boolean> {
	try {
		await fs.access(packPath(repoRoot));
		return true;
	} catch {
		return false;
	}
}
