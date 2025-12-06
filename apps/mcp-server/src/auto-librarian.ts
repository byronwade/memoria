/**
 * Auto-Librarian: Heuristic-based Memory Extraction
 *
 * Extracts meaningful memories from code without external LLMs.
 * Uses pattern matching on:
 * 1. Code comments (IMPORTANT, WARNING, HACK, etc.)
 * 2. PR/commit messages ("this broke...", "remember to...")
 * 3. Git commit messages with context
 *
 * The AI model already in the conversation handles semantic understanding.
 */

export interface ExtractedMemory {
	context: string;
	summary: string;
	keywords: string[];
	memoryType: "lesson" | "context" | "decision" | "pattern" | "warning" | "todo";
	importance: "critical" | "high" | "normal" | "low";
	source: {
		type: "pr_comment" | "commit_message" | "auto_extracted";
		reference: string | null;
	};
	linkedFiles: string[];
	confidence: number; // 0-100 confidence in extraction
}

// ============================================
// CODE COMMENT PATTERNS
// ============================================

interface CommentPattern {
	pattern: RegExp;
	memoryType: ExtractedMemory["memoryType"];
	importance: ExtractedMemory["importance"];
	minLength: number; // Minimum content length to extract
}

const COMMENT_PATTERNS: CommentPattern[] = [
	// Critical patterns - use [^\n*]* to avoid backtracking issues
	{
		pattern: /(?:\/\/|#|\/\*)\s*(?:CRITICAL|SECURITY|VULNERABILITY)[\s:]+([^\n*]+)/gim,
		memoryType: "warning",
		importance: "critical",
		minLength: 20,
	},
	{
		pattern: /(?:\/\/|#|\/\*)\s*(?:DO\s+NOT|NEVER|MUST\s+NOT)[\s:]+([^\n*]+)/gim,
		memoryType: "warning",
		importance: "critical",
		minLength: 15,
	},

	// High importance
	{
		pattern: /(?:\/\/|#|\/\*)\s*(?:IMPORTANT|WARNING|CAUTION)[\s:]+([^\n*]+)/gim,
		memoryType: "warning",
		importance: "high",
		minLength: 15,
	},
	{
		pattern: /(?:\/\/|#|\/\*)\s*(?:HACK|WORKAROUND|TEMPORARY)[\s:]+([^\n*]+)/gim,
		memoryType: "context",
		importance: "high",
		minLength: 15,
	},
	{
		pattern: /(?:\/\/|#|\/\*)\s*(?:This\s+is\s+needed\s+because|Required\s+for|Necessary\s+to)[\s:]+([^\n*]+)/gim,
		memoryType: "context",
		importance: "high",
		minLength: 20,
	},

	// Normal patterns
	{
		pattern: /(?:\/\/|#|\/\*)\s*(?:NOTE|NB)[\s:]+([^\n*]+)/gim,
		memoryType: "context",
		importance: "normal",
		minLength: 20,
	},
	{
		pattern: /(?:\/\/|#|\/\*)\s*(?:FIXME)[\s:]+([^\n*]+)/gim,
		memoryType: "todo",
		importance: "normal",
		minLength: 15,
	},
	{
		pattern: /(?:\/\/|#|\/\*)\s*(?:TODO)[\s:]+([^\n*]+)/gim,
		memoryType: "todo",
		importance: "low",
		minLength: 15,
	},

	// Explanatory comments with context
	{
		pattern: /(?:\/\/|#|\/\*)\s*(?:We\s+(?:do|use|need|have)\s+this\s+(?:because|since|due\s+to))([^\n*]+)/gim,
		memoryType: "decision",
		importance: "normal",
		minLength: 25,
	},
	{
		pattern: /(?:\/\/|#|\/\*)\s*(?:Don't\s+(?:remove|delete|change)\s+this)([^\n*]+)/gim,
		memoryType: "warning",
		importance: "high",
		minLength: 20,
	},
];

// ============================================
// COMMIT MESSAGE PATTERNS
// ============================================

interface CommitPattern {
	pattern: RegExp;
	memoryType: ExtractedMemory["memoryType"];
	importance: ExtractedMemory["importance"];
}

const COMMIT_PATTERNS: CommitPattern[] = [
	// Bug fix explanations - use [^\n]+ to avoid backtracking
	{
		pattern: /(?:fix|fixed|fixes|fixing)[\s:]+([^\n]{30,})/i,
		memoryType: "lesson",
		importance: "normal",
	},
	{
		pattern: /(?:this\s+(?:broke|breaks|was\s+breaking))[\s:]+([^\n]{20,})/i,
		memoryType: "warning",
		importance: "high",
	},

	// Reverts with context
	{
		pattern: /(?:revert|reverted|reverting)[\s:]+([^\n]{20,})/i,
		memoryType: "lesson",
		importance: "high",
	},

	// Decision explanations
	{
		pattern: /(?:we\s+(?:decided|chose|went\s+with))[\s:]+([^\n]{30,})/i,
		memoryType: "decision",
		importance: "normal",
	},
	{
		pattern: /(?:the\s+reason\s+(?:for|is|was))[\s:]+([^\n]{30,})/i,
		memoryType: "context",
		importance: "normal",
	},

	// Lessons learned
	{
		pattern: /(?:remember\s+to|don't\s+forget)[\s:]+([^\n]{15,})/i,
		memoryType: "lesson",
		importance: "high",
	},
	{
		pattern: /(?:we\s+learned\s+that)[\s:]+([^\n]{20,})/i,
		memoryType: "lesson",
		importance: "normal",
	},

	// Security notes
	{
		pattern: /(?:security|vulnerability|exploit|injection|xss|csrf)[\s:]+([^\n]{20,})/i,
		memoryType: "warning",
		importance: "critical",
	},

	// Breaking changes
	{
		pattern: /(?:breaking\s+change|breaking:)[\s:]+([^\n]{20,})/i,
		memoryType: "warning",
		importance: "critical",
	},
];

// ============================================
// PR COMMENT PATTERNS
// ============================================

const PR_COMMENT_PATTERNS: CommitPattern[] = [
	// Review feedback - use [^\n]+ to avoid backtracking
	{
		pattern: /(?:this\s+will\s+(?:break|cause\s+issues|fail))[\s:]+([^\n]{20,})/i,
		memoryType: "warning",
		importance: "high",
	},
	{
		pattern: /(?:we\s+should\s+(?:remember|note|keep\s+in\s+mind))[\s:]+([^\n]{20,})/i,
		memoryType: "lesson",
		importance: "normal",
	},

	// Architectural decisions
	{
		pattern: /(?:we\s+chose\s+(?:to|this\s+approach))[\s:]+([^\n]{30,})/i,
		memoryType: "decision",
		importance: "normal",
	},

	// Gotchas and edge cases
	{
		pattern: /(?:watch\s+out\s+for|be\s+careful\s+(?:with|about))[\s:]+([^\n]{20,})/i,
		memoryType: "warning",
		importance: "high",
	},
	{
		pattern: /(?:edge\s+case|corner\s+case)[\s:]+([^\n]{20,})/i,
		memoryType: "context",
		importance: "normal",
	},

	// Testing notes
	{
		pattern: /(?:make\s+sure\s+to\s+test|needs?\s+(?:to\s+be\s+)?tested?)[\s:]+([^\n]{20,})/i,
		memoryType: "todo",
		importance: "normal",
	},
];

// ============================================
// EXTRACTION FUNCTIONS
// ============================================

/**
 * Extract memories from code content (comments)
 */
export function extractFromCode(
	code: string,
	filePath: string,
): ExtractedMemory[] {
	const memories: ExtractedMemory[] = [];

	for (const { pattern, memoryType, importance, minLength } of COMMENT_PATTERNS) {
		// Reset regex state
		pattern.lastIndex = 0;

		let match;
		while ((match = pattern.exec(code)) !== null) {
			const content = match[1]?.trim();
			if (!content || content.length < minLength) continue;

			// Calculate confidence based on pattern specificity and content length
			const confidence = calculateConfidence(content, minLength);

			memories.push({
				context: content,
				summary: content.slice(0, 100) + (content.length > 100 ? "..." : ""),
				keywords: extractKeywords(content),
				memoryType,
				importance,
				source: {
					type: "auto_extracted",
					reference: filePath,
				},
				linkedFiles: [filePath],
				confidence,
			});
		}
	}

	return deduplicateMemories(memories);
}

/**
 * Extract memories from a commit message
 */
export function extractFromCommitMessage(
	message: string,
	commitHash: string,
	filesChanged: string[],
): ExtractedMemory[] {
	const memories: ExtractedMemory[] = [];

	for (const { pattern, memoryType, importance } of COMMIT_PATTERNS) {
		// Reset regex state
		pattern.lastIndex = 0;

		let match;
		while ((match = pattern.exec(message)) !== null) {
			const content = match[1]?.trim();
			if (!content || content.length < 15) continue;

			const confidence = calculateConfidence(content, 15);

			memories.push({
				context: `${message.split("\n")[0]}: ${content}`,
				summary: content.slice(0, 100) + (content.length > 100 ? "..." : ""),
				keywords: extractKeywords(content),
				memoryType,
				importance,
				source: {
					type: "commit_message",
					reference: commitHash,
				},
				linkedFiles: filesChanged.slice(0, 10), // Limit to first 10 files
				confidence,
			});
		}
	}

	return deduplicateMemories(memories);
}

/**
 * Extract memories from a PR comment
 */
export function extractFromPRComment(
	comment: string,
	prUrl: string,
	filesAffected: string[],
): ExtractedMemory[] {
	const memories: ExtractedMemory[] = [];

	for (const { pattern, memoryType, importance } of PR_COMMENT_PATTERNS) {
		// Reset regex state
		pattern.lastIndex = 0;

		let match;
		while ((match = pattern.exec(comment)) !== null) {
			const content = match[1]?.trim();
			if (!content || content.length < 15) continue;

			const confidence = calculateConfidence(content, 15);

			memories.push({
				context: content,
				summary: content.slice(0, 100) + (content.length > 100 ? "..." : ""),
				keywords: extractKeywords(content),
				memoryType,
				importance,
				source: {
					type: "pr_comment",
					reference: prUrl,
				},
				linkedFiles: filesAffected.slice(0, 10),
				confidence,
			});
		}
	}

	return deduplicateMemories(memories);
}

/**
 * Scan a file for extractable memories
 * Returns memories with confidence >= threshold
 */
export function scanFile(
	code: string,
	filePath: string,
	minConfidence = 50,
): ExtractedMemory[] {
	const memories = extractFromCode(code, filePath);
	return memories.filter((m) => m.confidence >= minConfidence);
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate confidence score for an extraction
 */
function calculateConfidence(content: string, minLength: number): number {
	let confidence = 50; // Base confidence

	// Length bonus (longer = more meaningful)
	const lengthBonus = Math.min(20, (content.length - minLength) / 5);
	confidence += lengthBonus;

	// Specific keywords boost confidence
	const highValueKeywords = [
		"because",
		"reason",
		"important",
		"critical",
		"security",
		"bug",
		"fix",
		"issue",
		"problem",
		"warning",
		"never",
		"always",
		"must",
		"required",
	];

	for (const keyword of highValueKeywords) {
		if (content.toLowerCase().includes(keyword)) {
			confidence += 5;
		}
	}

	// Cap at 100
	return Math.min(100, Math.round(confidence));
}

/**
 * Extract keywords from content
 */
function extractKeywords(text: string): string[] {
	const stopwords = new Set([
		"a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
		"of", "with", "by", "from", "as", "is", "was", "are", "were", "been",
		"be", "have", "has", "had", "do", "does", "did", "will", "would",
		"this", "that", "these", "those", "it", "its",
	]);

	const tokens = text
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, " ")
		.split(/\s+/)
		.filter((t) => t.length >= 3 && !stopwords.has(t));

	return [...new Set(tokens)].slice(0, 15);
}

/**
 * Remove duplicate memories (same context)
 */
function deduplicateMemories(memories: ExtractedMemory[]): ExtractedMemory[] {
	const seen = new Set<string>();
	return memories.filter((m) => {
		const key = m.context.toLowerCase().slice(0, 50);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

/**
 * Merge similar memories into one
 */
export function mergeSimilarMemories(
	memories: ExtractedMemory[],
	similarityThreshold = 0.7,
): ExtractedMemory[] {
	if (memories.length <= 1) return memories;

	const merged: ExtractedMemory[] = [];
	const used = new Set<number>();

	for (let i = 0; i < memories.length; i++) {
		if (used.has(i)) continue;

		const current = memories[i];
		const similar: ExtractedMemory[] = [current];

		for (let j = i + 1; j < memories.length; j++) {
			if (used.has(j)) continue;

			if (calculateSimilarity(current.keywords, memories[j].keywords) >= similarityThreshold) {
				similar.push(memories[j]);
				used.add(j);
			}
		}

		if (similar.length === 1) {
			merged.push(current);
		} else {
			// Merge similar memories - keep highest importance
			const highest = similar.reduce((prev, curr) => {
				const order = { critical: 4, high: 3, normal: 2, low: 1 };
				return order[curr.importance] > order[prev.importance] ? curr : prev;
			});

			// Combine linked files
			const allFiles = [...new Set(similar.flatMap((m) => m.linkedFiles))];

			merged.push({
				...highest,
				linkedFiles: allFiles.slice(0, 20),
				confidence: Math.max(...similar.map((m) => m.confidence)),
			});
		}

		used.add(i);
	}

	return merged;
}

/**
 * Calculate Jaccard similarity between two keyword sets
 */
function calculateSimilarity(keywords1: string[], keywords2: string[]): number {
	const set1 = new Set(keywords1);
	const set2 = new Set(keywords2);

	let intersection = 0;
	for (const k of set1) {
		if (set2.has(k)) intersection++;
	}

	const union = set1.size + set2.size - intersection;
	return union > 0 ? intersection / union : 0;
}
