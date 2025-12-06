import {
	Flame,
	GitBranch,
	Link2,
	type LucideIcon,
	Search,
	Shield,
} from "lucide-react";

export interface FeatureItem {
	slug: string;
	title: string;
	shortTitle: string;
	tagline: string;
	description: string;
	icon: LucideIcon;
	keywords: string[];
	content: {
		overview: string;
		howItWorks: {
			step: number;
			title: string;
			description: string;
		}[];
		technicalDetails: string;
		useCases: {
			title: string;
			description: string;
		}[];
		configuration?: {
			option: string;
			default: string;
			description: string;
		}[];
	};
	relatedFeatures?: string[];
}

export const featureItems: FeatureItem[] = [
	{
		slug: "volatility-engine",
		title: "Volatility Engine - Panic Keyword Detection for Code Stability",
		shortTitle: "Volatility Engine",
		tagline: "Detect unstable code before it breaks",
		description:
			"The Volatility Engine scans git commits for panic keywords like fix, bug, revert, urgent, and hotfix with time-decay weighting. Recent bugs matter more for identifying fragile code.",
		icon: Flame,
		keywords: [
			"volatility",
			"panic keywords",
			"bug detection",
			"code stability",
			"time decay",
			"bus factor",
		],
		content: {
			overview:
				"The Volatility Engine analyzes your git history to identify files that have been involved in bug fixes, hotfixes, and urgent changes. By tracking these 'panic keywords' in commit messages, it calculates a volatility score that helps your AI understand which files are historically problematic and require extra care when modifying.",
			howItWorks: [
				{
					step: 1,
					title: "Commit Scanning",
					description:
						"Scans all commits touching the target file for panic keywords in commit messages: fix, bug, revert, urgent, hotfix, broken, crash, error.",
				},
				{
					step: 2,
					title: "Time-Decay Weighting",
					description:
						"Applies exponential time decay - recent issues are weighted more heavily than older ones. A bug fixed yesterday matters more than one fixed a year ago.",
				},
				{
					step: 3,
					title: "Bus Factor Analysis",
					description:
						"Identifies how many unique contributors have modified the file. Low bus factor (1-2 contributors) indicates knowledge concentration risk.",
				},
				{
					step: 4,
					title: "Volatility Score",
					description:
						"Calculates a 0-100 volatility score based on frequency, recency, and severity of issues.",
				},
			],
			technicalDetails:
				"The engine uses `git log --format` to extract commit messages and timestamps. Each panic keyword hit is scored based on recency using an exponential decay function with a configurable half-life (default 90 days). The final score combines keyword frequency, time weighting, and contributor diversity.",
			useCases: [
				{
					title: "Pre-Refactor Assessment",
					description:
						"Before refactoring a file, check its volatility to understand historical risk and allocate appropriate review effort.",
				},
				{
					title: "Code Review Prioritization",
					description:
						"Focus code review effort on high-volatility files that are statistically more likely to contain bugs.",
				},
				{
					title: "New Developer Onboarding",
					description:
						"Help new team members understand which parts of the codebase require extra caution.",
				},
			],
			configuration: [
				{
					option: "panicKeywords",
					default: '["fix", "bug", "revert", "urgent", "hotfix", "broken"]',
					description: "Keywords to scan for in commit messages",
				},
				{
					option: "timeDecayDays",
					default: "90",
					description: "Half-life for time decay calculation in days",
				},
				{
					option: "volatilityThreshold",
					default: "50",
					description: "Score threshold to flag files as high-risk",
				},
			],
		},
		relatedFeatures: ["entanglement-engine", "sentinel-engine"],
	},
	{
		slug: "entanglement-engine",
		title: "Entanglement Engine - Detect Implicit File Dependencies",
		shortTitle: "Entanglement Engine",
		tagline: "Find files that change together",
		description:
			"The Entanglement Engine discovers files that frequently change together in commits, revealing implicit dependencies that import statements can't show. If two files change together more than 15% of the time, they're likely coupled.",
		icon: Link2,
		keywords: [
			"entanglement",
			"coupling",
			"dependencies",
			"co-change",
			"implicit",
			"correlation",
		],
		content: {
			overview:
				"The Entanglement Engine analyzes your git history to find files that tend to change together, even when they have no direct import relationship. This reveals 'spooky action at a distance' - when modifying File A usually requires changes to File B, even though there's no obvious connection in the code.",
			howItWorks: [
				{
					step: 1,
					title: "Co-Change Analysis",
					description:
						"Analyzes all commits to find pairs of files that are modified in the same commit.",
				},
				{
					step: 2,
					title: "Frequency Calculation",
					description:
						"Calculates the percentage of times each file pair changes together relative to total changes.",
				},
				{
					step: 3,
					title: "Threshold Filtering",
					description:
						"Filters to show only significant relationships (default >15% co-change rate).",
				},
				{
					step: 4,
					title: "Coupling Report",
					description:
						"Generates a report showing coupled files with their co-change percentage and last shared commit.",
				},
			],
			technicalDetails:
				"Uses `git log --name-only` to extract file lists from each commit. Builds an adjacency matrix of file co-occurrences and normalizes by individual file change frequency. Supports configurable thresholds and can exclude test files from analysis.",
			useCases: [
				{
					title: "Prevent Breaking Changes",
					description:
						"When your AI modifies a file, it sees which other files typically change with it and can proactively check them.",
				},
				{
					title: "Architecture Discovery",
					description:
						"Reveal hidden architectural dependencies that should perhaps be made explicit through proper interfaces.",
				},
				{
					title: "Refactoring Safety",
					description:
						"Understand the true blast radius of changes before refactoring interconnected components.",
				},
			],
			configuration: [
				{
					option: "couplingThreshold",
					default: "15",
					description: "Minimum co-change percentage to consider files coupled",
				},
				{
					option: "minCommits",
					default: "3",
					description: "Minimum shared commits required to establish coupling",
				},
				{
					option: "excludeTests",
					default: "false",
					description: "Exclude test files from coupling analysis",
				},
			],
		},
		relatedFeatures: ["volatility-engine", "sentinel-engine"],
	},
	{
		slug: "sentinel-engine",
		title: "Sentinel Engine - Stale Dependency Detection",
		shortTitle: "Sentinel Engine",
		tagline: "Catch out-of-sync dependencies",
		description:
			"The Sentinel Engine monitors coupled files and alerts when they become out of sync. If File A was updated but its coupled File B hasn't been touched in over 7 days, it may indicate a forgotten dependency.",
		icon: Shield,
		keywords: [
			"sentinel",
			"stale",
			"outdated",
			"sync",
			"dependencies",
			"monitoring",
		],
		content: {
			overview:
				"The Sentinel Engine builds on the Entanglement Engine by actively monitoring coupled files for staleness. When you're about to modify a file, Sentinel checks if any of its coupled files are suspiciously out of date, which could indicate forgotten synchronization requirements.",
			howItWorks: [
				{
					step: 1,
					title: "Load Coupling Data",
					description:
						"Retrieves the coupling relationships identified by the Entanglement Engine.",
				},
				{
					step: 2,
					title: "Check Last Modified",
					description:
						"For each coupled file, checks when it was last modified using git log.",
				},
				{
					step: 3,
					title: "Calculate Staleness",
					description:
						"Compares the time gap between the target file and its coupled files.",
				},
				{
					step: 4,
					title: "Generate Warnings",
					description:
						"Warns when coupled files exceed the staleness threshold (default 7 days).",
				},
			],
			technicalDetails:
				"Combines coupling data from the Entanglement Engine with `git log --format=%ai` to get last modification timestamps. Calculates date differences and applies the staleness threshold. Supports per-file threshold overrides for files that are expected to update less frequently.",
			useCases: [
				{
					title: "Configuration Drift Detection",
					description:
						"Catch when code changes but configuration files aren't updated.",
				},
				{
					title: "API Contract Violations",
					description:
						"Detect when API implementations change but clients haven't been updated.",
				},
				{
					title: "Documentation Staleness",
					description:
						"Identify when code changes but related documentation lags behind.",
				},
			],
			configuration: [
				{
					option: "stalenessThreshold",
					default: "7",
					description: "Days of inactivity before flagging as stale",
				},
				{
					option: "warningLevel",
					default: '"warning"',
					description: 'Alert level: "info", "warning", or "error"',
				},
				{
					option: "excludePatterns",
					default: '["*.md", "*.txt"]',
					description: "File patterns to exclude from staleness checks",
				},
			],
		},
		relatedFeatures: ["entanglement-engine", "static-import-engine"],
	},
	{
		slug: "static-import-engine",
		title: "Static Import Engine - Find Import Dependencies",
		shortTitle: "Static Import Engine",
		tagline: "Trace imports through your codebase",
		description:
			"The Static Import Engine uses git grep to find all files that import or require the target file. Works instantly even for brand new files with no git history.",
		icon: GitBranch,
		keywords: [
			"imports",
			"require",
			"dependencies",
			"grep",
			"references",
			"usage",
		],
		content: {
			overview:
				"Unlike the other engines that rely on git history, the Static Import Engine works with the current state of your codebase. It uses fast pattern matching to find all files that import, require, or reference the target file, giving you an immediate view of downstream dependencies.",
			howItWorks: [
				{
					step: 1,
					title: "Pattern Generation",
					description:
						"Generates search patterns for common import syntaxes: ES6 import, CommonJS require, dynamic import().",
				},
				{
					step: 2,
					title: "Git Grep Search",
					description:
						"Uses `git grep` for fast, index-aware searching across the entire repository.",
				},
				{
					step: 3,
					title: "Result Parsing",
					description:
						"Parses results to extract file paths, line numbers, and import types.",
				},
				{
					step: 4,
					title: "Dependency Tree",
					description:
						"Optionally builds a full dependency tree by recursively analyzing importers.",
				},
			],
			technicalDetails:
				"Uses `git grep -n` with regex patterns tailored to your project's language. Supports JavaScript/TypeScript (import/require), Python (import/from), Go (import), and more. Falls back to ripgrep or standard grep when git grep is unavailable.",
			useCases: [
				{
					title: "New File Analysis",
					description:
						"Understand who uses a file before you've made any commits to it.",
				},
				{
					title: "Refactoring Impact",
					description: "See all consumers of a module before changing its API.",
				},
				{
					title: "Dead Code Detection",
					description:
						"Find files that are never imported and may be candidates for removal.",
				},
			],
			configuration: [
				{
					option: "languages",
					default: '["javascript", "typescript", "python"]',
					description: "Languages to generate import patterns for",
				},
				{
					option: "customPatterns",
					default: "[]",
					description: "Additional regex patterns to search for",
				},
				{
					option: "maxDepth",
					default: "3",
					description: "Maximum depth for recursive dependency tree building",
				},
			],
		},
		relatedFeatures: ["entanglement-engine", "history-search"],
	},
	{
		slug: "history-search",
		title: "History Search - Understand Why Code Exists",
		shortTitle: "History Search",
		tagline: "Search git history for context",
		description:
			"History Search lets you query git history to understand WHY code was written. Solves the Chesterton's Fence problem - never delete code without understanding why it was added.",
		icon: Search,
		keywords: [
			"history",
			"search",
			"git log",
			"blame",
			"context",
			"reasoning",
			"archaeology",
		],
		content: {
			overview:
				"History Search provides natural language queries against your git history. Ask questions like 'why was this function added?' or 'what bug did this fix?' and get relevant commits with their context. This solves Chesterton's Fence - the principle that you should understand why something exists before removing it.",
			howItWorks: [
				{
					step: 1,
					title: "Query Parsing",
					description:
						"Parses natural language questions to extract key search terms and time ranges.",
				},
				{
					step: 2,
					title: "Git Log Search",
					description:
						"Searches commit messages, file changes, and diff content for relevant information.",
				},
				{
					step: 3,
					title: "Context Extraction",
					description:
						"Extracts surrounding context from commits including related files, authors, and linked issues.",
				},
				{
					step: 4,
					title: "Result Ranking",
					description:
						"Ranks results by relevance using text matching and temporal proximity to the code in question.",
				},
			],
			technicalDetails:
				"Combines `git log -S` (pickaxe) for content search, `git log --grep` for message search, and `git blame` for line-level attribution. Supports searching linked issue trackers (GitHub, Jira) when commit messages contain references.",
			useCases: [
				{
					title: "Understanding Legacy Code",
					description:
						"Before modifying old code, understand the context and constraints that shaped it.",
				},
				{
					title: "Bug Archaeology",
					description:
						"Trace the history of a bug to understand why previous fixes didn't work.",
				},
				{
					title: "Knowledge Transfer",
					description:
						"Help new team members understand the reasoning behind architectural decisions.",
				},
			],
			configuration: [
				{
					option: "searchDepth",
					default: "1000",
					description: "Maximum number of commits to search",
				},
				{
					option: "includeIssueLinks",
					default: "true",
					description: "Parse and follow links to issue trackers",
				},
				{
					option: "diffContext",
					default: "3",
					description: "Lines of diff context to include in results",
				},
			],
		},
		relatedFeatures: ["volatility-engine", "static-import-engine"],
	},
];

export function getFeatureBySlug(slug: string): FeatureItem | undefined {
	return featureItems.find((item) => item.slug === slug);
}

export function getAllFeatureSlugs(): string[] {
	return featureItems.map((item) => item.slug);
}
