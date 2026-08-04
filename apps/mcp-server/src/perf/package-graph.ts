import fs from "node:fs/promises";
import path from "node:path";
import type { SimpleGit } from "simple-git";

export interface PackageInfo {
	name: string;
	dir: string; // absolute
	relativeDir: string;
	dependencies: string[];
}

export interface PackageCouplingHit {
	file: string;
	score: number;
	source: "package";
	reason: string;
	confidence: number;
}

/**
 * Discover workspace packages (npm/pnpm/yarn workspaces + apps package.json globs).
 */
export async function discoverPackages(repoRoot: string): Promise<PackageInfo[]> {
	const packages: PackageInfo[] = [];
	const candidates = [
		"package.json",
		"apps/*/package.json",
		"packages/*/package.json",
		"services/*/package.json",
	];

	const rootPkg = await readJson(path.join(repoRoot, "package.json"));
	const workspaceGlobs: string[] = Array.isArray(rootPkg?.workspaces)
		? rootPkg.workspaces
		: Array.isArray(rootPkg?.workspaces?.packages)
			? rootPkg.workspaces.packages
			: ["apps/*", "packages/*"];

	const dirs = new Set<string>([repoRoot]);
	for (const glob of [...workspaceGlobs, ...candidates]) {
		const base = glob.replace(/\/?\*?\/?package\.json$/, "").replace(/\*$/, "");
		const abs = path.join(repoRoot, base);
		try {
			const entries = await fs.readdir(abs, { withFileTypes: true });
			for (const e of entries) {
				if (e.isDirectory()) dirs.add(path.join(abs, e.name));
			}
		} catch {
			/* not a dir */
		}
		// Also try direct package.json under glob root
		dirs.add(abs);
	}

	for (const dir of dirs) {
		const pkgPath = path.join(dir, "package.json");
		const pkg = await readJson(pkgPath);
		if (!pkg?.name) continue;
		const deps = {
			...pkg.dependencies,
			...pkg.devDependencies,
			...pkg.peerDependencies,
		};
		packages.push({
			name: pkg.name,
			dir,
			relativeDir: path.relative(repoRoot, dir).replace(/\\/g, "/") || ".",
			dependencies: Object.keys(deps ?? {}),
		});
	}

	return packages;
}

interface PackageJsonShape {
	name?: string;
	workspaces?: string[] | { packages?: string[] };
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
}

async function readJson(filePath: string): Promise<PackageJsonShape | null> {
	try {
		const raw = await fs.readFile(filePath, "utf8");
		const parsed: unknown = JSON.parse(raw);
		if (typeof parsed !== "object" || parsed === null) return null;
		return parsed as PackageJsonShape;
	} catch {
		return null;
	}
}

export function findPackageForFile(
	packages: PackageInfo[],
	filePath: string,
	repoRoot: string,
): PackageInfo | null {
	const rel = path.relative(repoRoot, filePath).replace(/\\/g, "/");
	let best: PackageInfo | null = null;
	for (const pkg of packages) {
		if (pkg.relativeDir === ".") continue;
		if (rel === pkg.relativeDir || rel.startsWith(pkg.relativeDir + "/")) {
			if (!best || pkg.relativeDir.length > best.relativeDir.length) {
				best = pkg;
			}
		}
	}
	return best;
}

/**
 * Couple files in packages that depend on (or are depended on by) the target's package.
 */
export async function getPackageCoupling(opts: {
	git: SimpleGit;
	repoRoot: string;
	filePath: string;
	packages?: PackageInfo[];
}): Promise<PackageCouplingHit[]> {
	const packages = opts.packages ?? (await discoverPackages(opts.repoRoot));
	const self = findPackageForFile(packages, opts.filePath, opts.repoRoot);
	if (!self || self.relativeDir === ".") return [];

	const dependents = packages.filter(
		(p) => p.name !== self.name && p.dependencies.includes(self.name),
	);
	const dependencies = packages.filter(
		(p) => p.name !== self.name && self.dependencies.includes(p.name),
	);

	const hits: PackageCouplingHit[] = [];
	for (const pkg of [...dependents, ...dependencies].slice(0, 8)) {
		const entry = path.join(pkg.relativeDir, "package.json");
		const isDependant = dependents.includes(pkg);
		hits.push({
			file: entry,
			score: isDependant ? 72 : 60,
			source: "package",
			reason: isDependant
				? `Package \`${pkg.name}\` depends on \`${self.name}\`. API changes may break it.`
				: `This package depends on \`${pkg.name}\`. Check shared contracts.`,
			confidence: 0.75,
		});
	}

	hits.sort((a, b) => b.score - a.score);
	return hits.slice(0, 5);
}
