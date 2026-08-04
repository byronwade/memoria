/**
 * Shared git pathspecs — keep engines from re-listing the same globs and from
 * scanning build artifacts.
 */

/** Source code pathspecs for git grep / ls-files. */
export const CODE_PATHSPECS = [
	"*.ts",
	"*.tsx",
	"*.js",
	"*.jsx",
	"*.mjs",
	"*.cjs",
	"*.py",
	"*.go",
	"*.rs",
	"*.java",
	"*.rb",
	"*.php",
	"*.cs",
	"*.kt",
	"*.swift",
] as const;

/** Excludes applied after includes (git pathspec magic). */
export const EXCLUDE_PATHSPECS = [
	":!**/node_modules/**",
	":!**/.next/**",
	":!**/dist/**",
	":!**/build/**",
	":!**/_generated/**",
	":!**/vendor/**",
	":!**/target/**",
	":!**/.turbo/**",
] as const;

export const TEST_EXCLUDE_PATHSPECS = [
	":!**/*test*",
	":!**/*spec*",
	":!**/__tests__/**",
	":!**/__mocks__/**",
] as const;

export const DOCS_PATHSPECS = ["*.md", "*.mdx", "*.mdc", "*.rst", "*.txt"] as const;

/** Standard args for source-code greps. */
export function codeGrepPathspecs(opts?: {
	includeTests?: boolean;
}): string[] {
	const specs: string[] = [...CODE_PATHSPECS, ...EXCLUDE_PATHSPECS];
	if (!opts?.includeTests) {
		specs.push(...TEST_EXCLUDE_PATHSPECS);
	}
	return specs;
}

/** Optional git grep threading (no-op on older git). */
export function grepThreadArgs(threads = 4): string[] {
	return [`--threads=${threads}`];
}
