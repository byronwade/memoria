import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import simpleGit, { type SimpleGit } from "simple-git";

/**
 * A disposable git repository on disk, used to test the git-backed engines
 * against deterministic, controlled history instead of the live Memoria repo.
 *
 * Each repo is created in a unique temp directory and should be cleaned up via
 * `cleanup()` (typically in an `afterEach`).
 */
export class TempGitRepo {
	readonly dir: string;
	readonly git: SimpleGit;

	private constructor(dir: string, git: SimpleGit) {
		this.dir = dir;
		this.git = git;
	}

	/** Create and initialize a new temp git repo with a deterministic identity. */
	static async create(prefix = "memoria-git-test-"): Promise<TempGitRepo> {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
		const git = simpleGit(dir);
		await git.init();
		// Local identity so commits work without relying on global git config.
		await git.addConfig("user.name", "Test User");
		await git.addConfig("user.email", "test@example.com");
		// Never block on commit signing in CI.
		await git.addConfig("commit.gpgsign", "false");
		return new TempGitRepo(dir, git);
	}

	/** Absolute path to a file inside the repo. */
	path(relativePath: string): string {
		return path.join(this.dir, relativePath);
	}

	/** Write a file (creating parent dirs) without committing. */
	write(relativePath: string, content: string): string {
		const abs = this.path(relativePath);
		fs.mkdirSync(path.dirname(abs), { recursive: true });
		fs.writeFileSync(abs, content);
		return abs;
	}

	/**
	 * Write the given files and create a single commit containing all of them.
	 * Returns the commit hash.
	 */
	async commit(
		message: string,
		files: Record<string, string>,
		opts: { date?: string } = {},
	): Promise<string> {
		const relPaths = Object.keys(files);
		for (const rel of relPaths) {
			this.write(rel, files[rel]);
		}
		await this.git.add(relPaths);
		const commitOptions: Record<string, string> = {};
		if (opts.date) {
			// Set both author and committer date for fully deterministic history.
			commitOptions["--date"] = opts.date;
		}
		const result = await this.git.commit(message, relPaths, commitOptions);
		return result.commit;
	}

	/** Remove the temp repo from disk. Safe to call multiple times. */
	cleanup(): void {
		fs.rmSync(this.dir, { recursive: true, force: true });
	}
}
