/**
 * BM25 (Best Match 25) Local Search Engine
 *
 * Zero-cost keyword matching for AI-native retrieval.
 * Instead of using embeddings, we use BM25/TF-IDF for filtering,
 * then let the AI model (already in the conversation) do semantic understanding.
 *
 * Parameters:
 * - k1 = 1.2 (term frequency saturation)
 * - b = 0.75 (document length normalization)
 */

// Common English stopwords to filter out
const STOPWORDS = new Set([
	"a",
	"an",
	"and",
	"are",
	"as",
	"at",
	"be",
	"by",
	"for",
	"from",
	"has",
	"he",
	"in",
	"is",
	"it",
	"its",
	"of",
	"on",
	"or",
	"she",
	"that",
	"the",
	"to",
	"was",
	"were",
	"will",
	"with",
	"this",
	"but",
	"they",
	"have",
	"had",
	"what",
	"when",
	"where",
	"who",
	"which",
	"why",
	"how",
	"all",
	"each",
	"every",
	"both",
	"few",
	"more",
	"most",
	"other",
	"some",
	"such",
	"no",
	"not",
	"only",
	"own",
	"same",
	"so",
	"than",
	"too",
	"very",
	"can",
	"just",
	"should",
	"now",
]);

// Programming-related stopwords
const CODE_STOPWORDS = new Set([
	"function",
	"const",
	"let",
	"var",
	"return",
	"export",
	"import",
	"default",
	"class",
	"interface",
	"type",
	"async",
	"await",
	"new",
	"null",
	"undefined",
	"true",
	"false",
	"if",
	"else",
	"switch",
	"case",
	"break",
	"continue",
	"for",
	"while",
	"do",
	"try",
	"catch",
	"finally",
	"throw",
	"extends",
	"implements",
	"public",
	"private",
	"protected",
	"static",
	"readonly",
	"void",
	"string",
	"number",
	"boolean",
	"any",
	"object",
	"array",
]);

export interface BM25Index {
	avgDocLength: number;
	docFrequencies: Map<string, number>; // How many docs contain each term
	totalDocs: number;
}

export interface ScoredDocument<T> {
	document: T;
	score: number;
	matchedTerms: string[];
}

/**
 * Build a BM25 index from a collection of keyword arrays
 */
export function buildBM25Index(documents: string[][]): BM25Index {
	const docFrequencies = new Map<string, number>();
	let totalLength = 0;

	for (const doc of documents) {
		const uniqueTerms = new Set(doc);
		totalLength += doc.length;

		for (const term of uniqueTerms) {
			docFrequencies.set(term, (docFrequencies.get(term) || 0) + 1);
		}
	}

	return {
		avgDocLength: documents.length > 0 ? totalLength / documents.length : 0,
		docFrequencies,
		totalDocs: documents.length,
	};
}

/**
 * Calculate BM25 score for a single document against query terms
 *
 * BM25 formula:
 * score = sum of IDF(qi) * (f(qi, D) * (k1 + 1)) / (f(qi, D) + k1 * (1 - b + b * |D|/avgdl))
 *
 * Where:
 * - IDF(qi) = log((N - n(qi) + 0.5) / (n(qi) + 0.5) + 1)
 * - f(qi, D) = frequency of term qi in document D
 * - |D| = document length
 * - avgdl = average document length
 */
export function calculateBM25Score(
	docKeywords: string[],
	queryKeywords: string[],
	index: BM25Index,
): { score: number; matchedTerms: string[] } {
	const k1 = 1.2;
	const b = 0.75;
	const docLength = docKeywords.length;
	const matchedTerms: string[] = [];

	// Count term frequencies in document
	const termFreq = new Map<string, number>();
	for (const term of docKeywords) {
		termFreq.set(term, (termFreq.get(term) || 0) + 1);
	}

	let score = 0;
	for (const queryTerm of queryKeywords) {
		const tf = termFreq.get(queryTerm) || 0;
		if (tf === 0) continue;

		matchedTerms.push(queryTerm);

		const docFreq = index.docFrequencies.get(queryTerm) || 0;
		// IDF with smoothing to avoid negative scores
		const idf = Math.log(
			(index.totalDocs - docFreq + 0.5) / (docFreq + 0.5) + 1,
		);

		// BM25 term score
		const numerator = tf * (k1 + 1);
		const denominator =
			tf + k1 * (1 - b + (b * docLength) / (index.avgDocLength || 1));

		score += idf * (numerator / denominator);
	}

	return { score, matchedTerms };
}

/**
 * Search documents using BM25 scoring
 */
export function searchBM25<T>(
	documents: Array<{ item: T; keywords: string[] }>,
	queryKeywords: string[],
	limit = 10,
): ScoredDocument<T>[] {
	if (queryKeywords.length === 0) return [];

	// Build index from all documents
	const index = buildBM25Index(documents.map((d) => d.keywords));

	// Score each document
	const scored: ScoredDocument<T>[] = [];
	for (const doc of documents) {
		const { score, matchedTerms } = calculateBM25Score(
			doc.keywords,
			queryKeywords,
			index,
		);
		if (score > 0) {
			scored.push({ document: doc.item, score, matchedTerms });
		}
	}

	// Sort by score descending and limit
	return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Extract keywords from natural language text
 *
 * Processing steps:
 * 1. Lowercase
 * 2. Split on non-word characters
 * 3. Remove stopwords
 * 4. Remove very short tokens (< 2 chars)
 * 5. Basic stemming (remove common suffixes)
 */
export function extractKeywords(text: string): string[] {
	if (!text || typeof text !== "string") return [];

	const tokens = text
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter((token) => {
			if (token.length < 2) return false;
			if (STOPWORDS.has(token)) return false;
			if (CODE_STOPWORDS.has(token)) return false;
			// Filter pure numbers unless they might be meaningful (like error codes)
			if (/^\d+$/.test(token) && token.length < 3) return false;
			return true;
		});

	// Basic stemming: remove common suffixes
	const stemmed = tokens.map((token) => {
		// Remove common plural/verb suffixes
		if (token.endsWith("ing") && token.length > 5) {
			return token.slice(0, -3);
		}
		if (token.endsWith("ed") && token.length > 4) {
			return token.slice(0, -2);
		}
		if (token.endsWith("es") && token.length > 4) {
			return token.slice(0, -2);
		}
		if (token.endsWith("s") && token.length > 3 && !token.endsWith("ss")) {
			return token.slice(0, -1);
		}
		if (token.endsWith("tion") && token.length > 6) {
			return token.slice(0, -4);
		}
		if (token.endsWith("ness") && token.length > 6) {
			return token.slice(0, -4);
		}
		if (token.endsWith("ment") && token.length > 6) {
			return token.slice(0, -4);
		}
		if (token.endsWith("able") && token.length > 6) {
			return token.slice(0, -4);
		}
		if (token.endsWith("ible") && token.length > 6) {
			return token.slice(0, -4);
		}
		return token;
	});

	// Remove duplicates while preserving order
	return [...new Set(stemmed)];
}

/**
 * Extract keywords from a file path
 *
 * Processing:
 * 1. Split on path separators and dots
 * 2. Extract meaningful segments
 * 3. Split camelCase/PascalCase
 * 4. Remove common file extensions
 */
export function extractFileKeywords(filePath: string): string[] {
	if (!filePath || typeof filePath !== "string") return [];

	// Remove common extensions
	const withoutExt = filePath.replace(
		/\.(ts|tsx|js|jsx|py|go|rs|java|rb|php|vue|svelte|astro|md|json|yaml|yml|toml|css|scss|less|html)$/i,
		"",
	);

	// Split on path separators, dots, underscores, hyphens
	const segments = withoutExt.split(/[/\\._-]+/);

	const keywords: string[] = [];

	for (const segment of segments) {
		if (segment.length < 2) continue;
		if (segment === "src" || segment === "lib" || segment === "dist") continue;
		if (segment === "index" || segment === "main" || segment === "app") {
			// Include but continue to get more context
			keywords.push(segment.toLowerCase());
			continue;
		}

		// Split camelCase and PascalCase
		const camelSplit = segment
			.replace(/([a-z])([A-Z])/g, "$1 $2")
			.replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
			.split(/\s+/);

		for (const part of camelSplit) {
			const lower = part.toLowerCase();
			if (lower.length >= 2 && !STOPWORDS.has(lower)) {
				keywords.push(lower);
			}
		}
	}

	return [...new Set(keywords)];
}

/**
 * Extract keywords from code content
 *
 * Extracts:
 * - Function/method names
 * - Class/interface names
 * - Important identifiers
 * - String literals (especially error messages)
 */
export function extractCodeKeywords(code: string): string[] {
	if (!code || typeof code !== "string") return [];

	const keywords: string[] = [];

	// Extract function/method definitions
	const funcMatches = code.matchAll(
		/(?:function|async function|def|fn|func)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g,
	);
	for (const match of funcMatches) {
		keywords.push(...splitIdentifier(match[1]));
	}

	// Extract class/interface definitions
	const classMatches = code.matchAll(
		/(?:class|interface|struct|enum|type)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g,
	);
	for (const match of classMatches) {
		keywords.push(...splitIdentifier(match[1]));
	}

	// Extract const/let/var declarations (meaningful ones)
	const varMatches = code.matchAll(
		/(?:const|let|var|val)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g,
	);
	for (const match of varMatches) {
		const name = match[1];
		// Skip short or common variable names
		if (name.length > 3 && !["temp", "data", "item", "result"].includes(name)) {
			keywords.push(...splitIdentifier(name));
		}
	}

	// Extract error messages and important strings
	const stringMatches = code.matchAll(
		/["'`]([^"'`]{10,100})["'`]/g,
	);
	for (const match of stringMatches) {
		const str = match[1];
		// Look for error-like or descriptive strings
		if (
			/error|fail|invalid|missing|require|expect|must|should|cannot|unable/i.test(
				str,
			)
		) {
			keywords.push(...extractKeywords(str));
		}
	}

	return [...new Set(keywords)];
}

/**
 * Split a camelCase/PascalCase/snake_case identifier into keywords
 */
function splitIdentifier(identifier: string): string[] {
	return identifier
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
		.replace(/_+/g, " ")
		.toLowerCase()
		.split(/\s+/)
		.filter((w) => w.length >= 2 && !CODE_STOPWORDS.has(w));
}

/**
 * Combine keywords from multiple sources, weighting by importance
 */
export function combineKeywords(
	sources: Array<{ keywords: string[]; weight: number }>,
): string[] {
	const weighted = new Map<string, number>();

	for (const { keywords, weight } of sources) {
		for (const keyword of keywords) {
			weighted.set(keyword, (weighted.get(keyword) || 0) + weight);
		}
	}

	// Sort by weight and return
	return Array.from(weighted.entries())
		.sort((a, b) => b[1] - a[1])
		.map(([keyword]) => keyword);
}

/**
 * Calculate similarity between two keyword sets (Jaccard-like)
 */
export function keywordSimilarity(
	keywords1: string[],
	keywords2: string[],
): number {
	if (keywords1.length === 0 || keywords2.length === 0) return 0;

	const set1 = new Set(keywords1);
	const set2 = new Set(keywords2);

	let intersection = 0;
	for (const k of set1) {
		if (set2.has(k)) intersection++;
	}

	const union = set1.size + set2.size - intersection;
	return union > 0 ? intersection / union : 0;
}
