import path from "node:path";

export type LanguageId =
	| "typescript"
	| "javascript"
	| "python"
	| "go"
	| "rust"
	| "java"
	| "unknown";

export function detectLanguage(filePath: string): LanguageId {
	const ext = path.extname(filePath).toLowerCase();
	switch (ext) {
		case ".ts":
		case ".tsx":
		case ".mts":
		case ".cts":
			return "typescript";
		case ".js":
		case ".jsx":
		case ".mjs":
		case ".cjs":
			return "javascript";
		case ".py":
		case ".pyi":
			return "python";
		case ".go":
			return "go";
		case ".rs":
			return "rust";
		case ".java":
		case ".kt":
			return "java";
		default:
			return "unknown";
	}
}

/**
 * Build language-aware import grep patterns for a basename / path hint.
 * Returns extended-regex alternatives suitable for `git grep -E`.
 */
export function importGrepPatterns(opts: {
	fileName: string;
	parentDir: string;
	generic: boolean;
	language: LanguageId;
}): string[] {
	const esc = opts.fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const parent = opts.parentDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const patterns: string[] = [];

	switch (opts.language) {
		case "python":
			// from .module import / import package.module
			if (opts.generic) {
				patterns.push(`(?:from|import)\\s+[\\w.]*${parent}\\.${esc}\\b`);
				patterns.push(`(?:from|import)\\s+\\.?${esc}\\b`);
			} else {
				patterns.push(`(?:from|import)\\s+[\\w.]*${esc}\\b`);
			}
			break;
		case "go":
			// import ".../parent/file" (Go files often omit extension)
			if (opts.generic) {
				patterns.push(`import\\s+(?:\\w+\\s+)?["'][^"']*${parent}/${esc}["']`);
			} else {
				patterns.push(`import\\s+(?:\\w+\\s+)?["'][^"']*${esc}["']`);
			}
			break;
		case "rust":
			// mod name; use crate::...::name
			patterns.push(`\\bmod\\s+${esc}\\s*;`);
			patterns.push(`\\buse\\s+[\\w:]*::${esc}\\b`);
			break;
		case "java":
			patterns.push(`import\\s+[\\w.]*\\.${esc}\\s*;`);
			break;
		default:
			// JS/TS (and unknown fallback)
			if (opts.generic) {
				patterns.push(
					`(import|from|require).*['"](\\.\\/${esc}(\\.[jt]sx?)?|[^'"]*${parent}\\/${esc}(\\.[jt]sx?)?)['"]`,
				);
			} else {
				patterns.push(`(import|from|require).*['"].*${esc}`);
			}
			break;
	}

	return patterns;
}

/** Pathspecs preferred when searching for importers of a given language. */
export function importerPathspecs(language: LanguageId): string[] {
	switch (language) {
		case "python":
			return ["*.py", "*.pyi"];
		case "go":
			return ["*.go"];
		case "rust":
			return ["*.rs"];
		case "java":
			return ["*.java", "*.kt"];
		case "typescript":
			return ["*.ts", "*.tsx", "*.mts", "*.cts"];
		case "javascript":
			return ["*.js", "*.jsx", "*.mjs", "*.cjs"];
		default:
			return ["*.ts", "*.tsx", "*.js", "*.jsx", "*.py", "*.go", "*.rs", "*.java"];
	}
}
