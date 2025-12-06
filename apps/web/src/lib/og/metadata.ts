export interface OGPageMetadata {
	title: string;
	description: string;
	category?: string;
}

export const ogMetadata: Record<string, OGPageMetadata> = {
	"/": {
		title: "Memoria",
		description:
			"Prevent your AI from breaking code by revealing hidden file dependencies through git forensics.",
	},
	"/docs": {
		title: "Documentation",
		description:
			"Learn how to install, configure, and use Memoria with your AI assistant.",
		category: "Docs",
	},
	"/docs/installation": {
		title: "Installation",
		description:
			"Get Memoria set up with your favorite AI tool in under 2 minutes.",
		category: "Getting Started",
	},
	"/docs/installation/claude": {
		title: "Claude Desktop Setup",
		description:
			"Step-by-step guide to install Memoria for Claude Desktop on macOS or Windows.",
		category: "Installation Guide",
	},
	"/docs/installation/cursor": {
		title: "Cursor Setup",
		description: "Configure Memoria for the Cursor AI code editor.",
		category: "Installation Guide",
	},
	"/docs/installation/windsurf": {
		title: "Windsurf Setup",
		description: "Install Memoria for Codeium's Windsurf editor.",
		category: "Installation Guide",
	},
	"/docs/installation/continue": {
		title: "Continue Setup",
		description: "Set up Memoria for the Continue VS Code extension.",
		category: "Installation Guide",
	},
	"/docs/how-it-works": {
		title: "How It Works",
		description:
			"Learn how Memoria uses git forensics to detect hidden file dependencies.",
		category: "Concepts",
	},
	"/docs/configuration": {
		title: "Configuration",
		description:
			"Customize thresholds, ignore patterns, and risk weights for your project.",
		category: "Reference",
	},
	"/docs/auto-pilot": {
		title: "Auto-Pilot Mode",
		description:
			"Make your AI automatically analyze files before modifying them.",
		category: "Advanced",
	},
	"/docs/cli": {
		title: "CLI Reference",
		description:
			"Command-line interface for Memoria setup and standalone usage.",
		category: "Reference",
	},
	"/docs/troubleshooting": {
		title: "Troubleshooting",
		description: "Common issues and how to resolve them quickly.",
		category: "Support",
	},
	"/docs/features": {
		title: "Features",
		description:
			"Explore Memoria's five powerful engines for AI-powered code analysis.",
		category: "Docs",
	},
	"/docs/api": {
		title: "API Reference",
		description:
			"Complete documentation for Memoria MCP tools: analyze_file and ask_history.",
		category: "Reference",
	},
	"/docs/changelog": {
		title: "Changelog",
		description:
			"Version history and release notes for Memoria. Track updates and changes.",
		category: "Updates",
	},
	"/docs/security": {
		title: "Security & Privacy",
		description:
			"Privacy-first architecture. Your code never leaves your machine.",
		category: "Security",
	},
	"/docs/contributing": {
		title: "Contributing",
		description:
			"Help make Memoria better. Development setup and contribution guide.",
		category: "Community",
	},
};

export function getOGMetadata(path: string): OGPageMetadata {
	return (
		ogMetadata[path] || {
			title: "Memoria",
			description: "The Memory Your AI Lacks",
			category: "Docs",
		}
	);
}
