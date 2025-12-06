/**
 * Context Response Formatter
 *
 * Formats the Tri-Layer Brain data into AI-optimized markdown
 * that the AI model can easily parse and understand.
 */

export interface Memory {
	_id: string;
	context: string;
	summary?: string;
	tags: string[];
	keywords?: string[];
	linkedFiles: string[];
	memoryType?: "lesson" | "context" | "decision" | "pattern" | "warning" | "todo";
	importance?: "critical" | "high" | "normal" | "low";
	accessCount?: number;
	createdAt: number;
	score?: number;
	matchReason?: string;
}

export interface CodeFile {
	_id: string;
	filePath: string;
	language: string;
	riskScore: number;
	exports: Array<{
		name: string;
		kind: string;
		signature?: string;
		line: number;
	}>;
	imports: Array<{
		source: string;
		specifiers: string[];
		isRelative: boolean;
	}>;
}

export interface CodeRelationship {
	type: "imports" | "co_changes" | "tests" | "types" | "transitive";
	strength: number;
	evidence?: string;
	targetFile?: {
		path: string;
		riskScore: number;
	};
}

export interface Commit {
	commitHash: string;
	message: string;
	authorName: string;
	committedAt: number;
	commitType: string;
	panicScore: number;
	filesChanged: string[];
}

export interface ContextResponse {
	filePath: string;
	memories: Memory[];
	codeFile?: CodeFile;
	relationships: CodeRelationship[];
	recentCommits: Commit[];
	riskAssessment: {
		score: number;
		level: "low" | "medium" | "high" | "critical";
		factors: string[];
	};
}

/**
 * Format context response into AI-optimized markdown
 */
export function formatContextResponse(response: ContextResponse): string {
	const sections: string[] = [];
	const fileName = response.filePath.split("/").pop() || response.filePath;

	// Header with file info
	sections.push(`### Context for \`${fileName}\`\n`);

	// Risk assessment
	sections.push(
		`**RISK: ${response.riskAssessment.score}/100 (${response.riskAssessment.level.toUpperCase()})**`,
	);
	if (response.riskAssessment.factors.length > 0) {
		sections.push(`> ${response.riskAssessment.factors.join(" • ")}`);
	}
	sections.push("");

	// Critical/High importance memories first
	const criticalMemories = response.memories.filter(
		(m) => m.importance === "critical" || m.importance === "high",
	);
	if (criticalMemories.length > 0) {
		sections.push("---\n");
		sections.push("**CRITICAL MEMORIES**\n");
		for (const memory of criticalMemories) {
			const levelLabel = memory.importance === "critical" ? "[CRITICAL]" : "[WARNING]";
			const typeLabel = memory.memoryType ? `[${memory.memoryType.toUpperCase()}]` : "";
			sections.push(`${levelLabel} **${typeLabel}** ${memory.summary || memory.context.slice(0, 100)}`);
			if (memory.matchReason) {
				sections.push(`   _Match: ${memory.matchReason}_`);
			}
		}
		sections.push("");
	}

	// Other memories
	const otherMemories = response.memories.filter(
		(m) => m.importance !== "critical" && m.importance !== "high",
	);
	if (otherMemories.length > 0) {
		sections.push("---\n");
		sections.push(`**OTHER CONTEXT** (${otherMemories.length} items)\n`);
		sections.push("| Type | Summary | Tags |");
		sections.push("|------|---------|------|");
		for (const memory of otherMemories.slice(0, 10)) {
			const type = memory.memoryType || "context";
			const summary = (memory.summary || memory.context.slice(0, 50)).replace(/\|/g, "\\|");
			const tags = memory.tags.slice(0, 3).join(", ");
			sections.push(`| ${type} | ${summary} | ${tags} |`);
		}
		if (otherMemories.length > 10) {
			sections.push(`\n_...and ${otherMemories.length - 10} more_`);
		}
		sections.push("");
	}

	// Code graph relationships
	if (response.relationships.length > 0) {
		sections.push("---\n");
		sections.push("**CODE GRAPH**\n");

		// Group by relationship type
		const imports = response.relationships.filter((r) => r.type === "imports");
		const coChanges = response.relationships.filter((r) => r.type === "co_changes");
		const tests = response.relationships.filter((r) => r.type === "tests");

		if (imports.length > 0) {
			const importPaths = imports
				.map((r) => r.targetFile?.path.split("/").pop() || "unknown")
				.join(", ");
			sections.push(`- **Imports:** ${importPaths}`);
		}

		if (coChanges.length > 0) {
			sections.push(`- **Co-changed files:** ${coChanges.length}`);
			for (const rel of coChanges.slice(0, 3)) {
				const fileName = rel.targetFile?.path.split("/").pop() || "unknown";
				sections.push(`  - \`${fileName}\` (${rel.strength}% coupled)`);
			}
		}

		if (tests.length > 0) {
			const testPaths = tests
				.map((r) => r.targetFile?.path.split("/").pop() || "unknown")
				.join(", ");
			sections.push(`- **Test files:** ${testPaths}`);
		}

		sections.push("");
	}

	// Recent relevant commits
	const highPanicCommits = response.recentCommits.filter((c) => c.panicScore >= 50);
	if (highPanicCommits.length > 0) {
		sections.push("---\n");
		sections.push("**RECENT HIGH-RISK COMMITS**\n");
		for (const commit of highPanicCommits.slice(0, 5)) {
			const date = new Date(commit.committedAt).toLocaleDateString();
			const shortHash = commit.commitHash.slice(0, 7);
			const firstLine = commit.message.split("\n")[0].slice(0, 60);
			sections.push(`- **[${shortHash}]** ${date} - ${firstLine}${firstLine.length >= 60 ? "..." : ""}`);
		}
		sections.push("");
	}

	// Pre-flight checklist
	sections.push("---\n");
	sections.push("**PRE-FLIGHT CHECKLIST**\n");
	sections.push(`- [ ] Modify \`${fileName}\` (primary target)`);

	// Add coupled files to checklist
	const coupledFiles = response.relationships
		.filter((r) => r.type === "co_changes" && r.strength >= 30)
		.slice(0, 5);
	for (const rel of coupledFiles) {
		const fileName = rel.targetFile?.path.split("/").pop() || "unknown";
		sections.push(`- [ ] Verify \`${fileName}\` (${rel.strength}% coupled)`);
	}

	// Add critical memory warnings
	for (const memory of criticalMemories.slice(0, 3)) {
		const shortContext = memory.summary || memory.context.slice(0, 40);
		sections.push(`- [ ] Review: ${shortContext}`);
	}

	return sections.join("\n");
}

/**
 * Format a minimal response for low-risk files
 */
export function formatMinimalResponse(filePath: string, riskScore: number): string {
	const fileName = filePath.split("/").pop() || filePath;
	return `### Context for \`${fileName}\`

**RISK: ${riskScore}/100 (LOW)**
> No critical memories or high-risk patterns detected. Safe to proceed normally.

**PRE-FLIGHT CHECKLIST**
- [ ] Modify \`${fileName}\`
`;
}

/**
 * Format the save_lesson response
 */
export function formatSaveLessonResponse(
	success: boolean,
	memoryId?: string,
	error?: string,
): string {
	if (success && memoryId) {
		return `**Lesson saved successfully**

Memory ID: \`${memoryId}\`

This context will be surfaced the next time you or another AI works with the linked files.`;
	}

	return `**Failed to save lesson**

${error || "Unknown error occurred"}

Please try again or save this context manually in the dashboard.`;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Build risk assessment from various factors
 */
export function buildRiskAssessment(
	volatilityScore: number,
	couplingCount: number,
	importerCount: number,
	criticalMemoryCount: number,
): { score: number; level: "low" | "medium" | "high" | "critical"; factors: string[] } {
	const factors: string[] = [];

	// Volatility contribution (35%)
	const volatilityContrib = volatilityScore * 0.35;
	if (volatilityScore >= 50) {
		factors.push(`High volatility (${volatilityScore}% panic score)`);
	}

	// Coupling contribution (30%)
	const couplingContrib = Math.min(100, couplingCount * 10) * 0.3;
	if (couplingCount >= 3) {
		factors.push(`Tightly coupled (${couplingCount} files)`);
	}

	// Importer contribution (20%)
	const importerContrib = Math.min(100, importerCount * 5) * 0.2;
	if (importerCount >= 5) {
		factors.push(`Heavily imported (${importerCount} files depend on this)`);
	}

	// Critical memory contribution (15%)
	const memoryContrib = Math.min(100, criticalMemoryCount * 30) * 0.15;
	if (criticalMemoryCount > 0) {
		factors.push(`${criticalMemoryCount} critical memories`);
	}

	const score = Math.round(volatilityContrib + couplingContrib + importerContrib + memoryContrib);

	let level: "low" | "medium" | "high" | "critical";
	if (score >= 75) level = "critical";
	else if (score >= 50) level = "high";
	else if (score >= 25) level = "medium";
	else level = "low";

	return { score, level, factors };
}
