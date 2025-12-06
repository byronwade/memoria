import {
	FileJson,
	FolderCog,
	Gauge,
	GitBranch,
	Layers,
	Lock,
	type LucideIcon,
	Terminal,
	Wifi,
} from "lucide-react";

export interface TroubleshootingItem {
	slug: string;
	title: string;
	shortTitle: string;
	description: string;
	icon: LucideIcon;
	keywords: string[];
	content: {
		problem: string;
		causes: string[];
		solutions: {
			title: string;
			description: string;
			code?: string;
		}[];
	};
	relatedIssues?: string[];
}

export const troubleshootingItems: TroubleshootingItem[] = [
	{
		slug: "command-not-found",
		title: "How to Fix 'Command Not Found' Errors in Memoria",
		shortTitle: "Command Not Found",
		description:
			"Resolve 'command not found' errors when running npx or memoria commands. Learn how to fix PATH issues and verify npm installation.",
		icon: Terminal,
		keywords: [
			"command not found",
			"npx not found",
			"memoria not found",
			"PATH",
			"npm",
		],
		content: {
			problem:
				"When running Memoria commands, you see 'command not found' or 'npx is not recognized'.",
			causes: [
				"Node.js/npm is not installed",
				"npm is not in your system PATH",
				"Shell configuration not reloaded after installation",
			],
			solutions: [
				{
					title: "Verify Node.js Installation",
					description: "Check if Node.js and npm are properly installed.",
					code: "node --version\nnpm --version",
				},
				{
					title: "Add npm to PATH (macOS/Linux)",
					description: "Add npm's bin directory to your system PATH.",
					code: '# Add to ~/.zshrc or ~/.bashrc\nexport PATH="$PATH:$(npm bin -g)"\n\n# Reload shell\nsource ~/.zshrc',
				},
				{
					title: "Add npm to PATH (Windows)",
					description:
						"Ensure npm is in your PATH by reinstalling Node.js with the 'Add to PATH' option checked, or manually add the npm directory to your system environment variables.",
				},
			],
		},
		relatedIssues: ["nodejs-version", "path-configuration"],
	},
	{
		slug: "nodejs-version",
		title: "Node.js Version Requirements for Memoria",
		shortTitle: "Node.js Version",
		description:
			"Fix Node.js version errors. Memoria requires Node.js 18+. Learn how to update Node.js using nvm or direct download.",
		icon: Layers,
		keywords: [
			"node version",
			"nodejs 18",
			"nvm",
			"update node",
			"version mismatch",
		],
		content: {
			problem:
				"Memoria requires Node.js 18 or higher but your system has an older version.",
			causes: [
				"Node.js version is below 18",
				"Multiple Node.js versions installed",
				"Using system Node.js instead of nvm-managed version",
			],
			solutions: [
				{
					title: "Check Current Version",
					description: "Verify your current Node.js version.",
					code: "node --version",
				},
				{
					title: "Update Using nvm (Recommended)",
					description: "Use nvm to install and switch to Node.js 20.",
					code: "# Install nvm if needed\ncurl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash\n\n# Install Node.js 20\nnvm install 20\nnvm use 20\nnvm alias default 20",
				},
				{
					title: "Direct Download",
					description:
						"Download the latest Node.js LTS version from nodejs.org and install it.",
				},
			],
		},
		relatedIssues: ["command-not-found"],
	},
	{
		slug: "path-configuration",
		title: "Fixing PATH Configuration Issues for Memoria",
		shortTitle: "Path Configuration",
		description:
			"Troubleshoot PATH configuration problems on macOS, Linux, and Windows. Ensure your shell can find npm and npx commands.",
		icon: FolderCog,
		keywords: [
			"PATH",
			"environment variables",
			"shell config",
			"zshrc",
			"bashrc",
		],
		content: {
			problem:
				"Your shell cannot find npm, npx, or Memoria commands even though Node.js is installed.",
			causes: [
				"Node.js bin directory not in PATH",
				"Shell configuration file not sourced",
				"Wrong shell configuration file edited",
				"PATH variable overwritten",
			],
			solutions: [
				{
					title: "Find Your npm Location",
					description: "Determine where npm is installed.",
					code: "which npm\n# or on Windows\nwhere npm",
				},
				{
					title: "Add to Shell Config (macOS/Linux)",
					description: "Add the npm bin directory to your shell configuration.",
					code: "# For zsh (default on macOS)\necho 'export PATH=\"$PATH:/usr/local/bin\"' >> ~/.zshrc\nsource ~/.zshrc\n\n# For bash\necho 'export PATH=\"$PATH:/usr/local/bin\"' >> ~/.bashrc\nsource ~/.bashrc",
				},
				{
					title: "Windows PATH Setup",
					description:
						"Open System Properties > Environment Variables and add the Node.js installation directory to your PATH variable.",
				},
			],
		},
		relatedIssues: ["command-not-found", "nodejs-version"],
	},
	{
		slug: "mcp-connection",
		title: "Troubleshooting MCP Server Connection Issues",
		shortTitle: "MCP Connection",
		description:
			"Fix MCP server connection problems with Claude Desktop, Cursor, Windsurf, and Continue. Debug configuration and connectivity issues.",
		icon: Wifi,
		keywords: [
			"MCP",
			"connection",
			"server",
			"Claude",
			"Cursor",
			"not connecting",
		],
		content: {
			problem:
				"Your AI tool cannot connect to Memoria's MCP server or doesn't see the available tools.",
			causes: [
				"Invalid JSON in configuration file",
				"Wrong file path in config",
				"AI tool not restarted after config change",
				"Memoria not installed globally",
			],
			solutions: [
				{
					title: "Validate JSON Configuration",
					description:
						"Ensure your configuration file has valid JSON syntax. Use a JSON validator to check for missing commas, brackets, or quotes.",
					code: '{\n  "mcpServers": {\n    "memoria": {\n      "command": "npx",\n      "args": ["@byronwade/memoria"]\n    }\n  }\n}',
				},
				{
					title: "Restart Your AI Tool",
					description:
						"Completely quit and reopen your AI tool (Claude Desktop, Cursor, etc.) after making configuration changes.",
				},
				{
					title: "Check Tool Availability",
					description:
						"Ask your AI assistant: 'What MCP tools do you have available?' to verify the connection.",
				},
				{
					title: "Enable Verbose Logging",
					description:
						"Run Memoria with verbose logging to see connection details.",
					code: "npx @byronwade/memoria --verbose",
				},
			],
		},
		relatedIssues: ["config-file-errors"],
	},
	{
		slug: "git-not-available",
		title: "Resolving 'Git Not Available' Errors",
		shortTitle: "Git Not Available",
		description:
			"Fix errors when git is not found or the project is not a git repository. Memoria requires git history to analyze file dependencies.",
		icon: GitBranch,
		keywords: [
			"git",
			"not a repository",
			"git init",
			"no git history",
			"fatal",
		],
		content: {
			problem:
				"Memoria reports 'not a git repository' or cannot find git on your system.",
			causes: [
				"Project directory is not a git repository",
				"Git is not installed",
				"Git is not in PATH",
				"Repository has no commits",
			],
			solutions: [
				{
					title: "Initialize Git Repository",
					description:
						"If your project isn't a git repository, initialize one.",
					code: 'git init\ngit add .\ngit commit -m "Initial commit"',
				},
				{
					title: "Verify Git Installation",
					description: "Check if git is installed and accessible.",
					code: "git --version",
				},
				{
					title: "Install Git",
					description:
						"Install git using your package manager or download from git-scm.com.",
					code: "# macOS\nbrew install git\n\n# Ubuntu/Debian\nsudo apt install git\n\n# Windows - download from git-scm.com",
				},
				{
					title: "Create Initial Commits",
					description:
						"Memoria needs git history to analyze. Make a few commits to build up history.",
				},
			],
		},
		relatedIssues: ["path-configuration"],
	},
	{
		slug: "permission-errors",
		title: "Fixing Permission Denied Errors",
		shortTitle: "Permission Errors",
		description:
			"Resolve npm permission errors on macOS and Linux. Fix EACCES errors when installing or running Memoria.",
		icon: Lock,
		keywords: [
			"permission denied",
			"EACCES",
			"sudo",
			"npm permissions",
			"global install",
		],
		content: {
			problem:
				"You see 'EACCES: permission denied' or similar errors when running npm or Memoria.",
			causes: [
				"npm global directory has wrong permissions",
				"Using sudo to install packages (not recommended)",
				"System npm installation with restricted access",
			],
			solutions: [
				{
					title: "Fix npm Permissions (Recommended)",
					description:
						"Change npm's default directory to a user-owned location.",
					code: "mkdir ~/.npm-global\nnpm config set prefix '~/.npm-global'\n\n# Add to ~/.zshrc or ~/.bashrc\nexport PATH=~/.npm-global/bin:$PATH\n\nsource ~/.zshrc",
				},
				{
					title: "Use nvm",
					description:
						"Node Version Manager handles permissions automatically.",
					code: "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash\nnvm install 20\nnvm use 20",
				},
				{
					title: "Avoid sudo with npm",
					description:
						"Never use 'sudo npm install'. This creates permission issues. Use one of the above solutions instead.",
				},
			],
		},
		relatedIssues: ["command-not-found", "path-configuration"],
	},
	{
		slug: "config-file-errors",
		title: "Configuration File Errors and Solutions",
		shortTitle: "Configuration Files",
		description:
			"Fix configuration file issues including JSON syntax errors, wrong file locations, and invalid settings for Memoria.",
		icon: FileJson,
		keywords: [
			"config",
			"JSON",
			"syntax error",
			"claude_desktop_config.json",
			"settings",
		],
		content: {
			problem:
				"Memoria cannot read your configuration file or reports invalid configuration.",
			causes: [
				"Invalid JSON syntax (missing commas, brackets)",
				"Configuration file in wrong location",
				"Wrong property names or values",
				"File encoding issues",
			],
			solutions: [
				{
					title: "Validate JSON Syntax",
					description:
						"Use a JSON validator or editor with JSON support to check syntax.",
					code: "# Use jq to validate\ncat config.json | jq .\n\n# Or use Node.js\nnode -e \"console.log(JSON.parse(require('fs').readFileSync('config.json')))\"",
				},
				{
					title: "Check File Location",
					description: "Ensure your config file is in the correct location.",
					code: "# Claude Desktop\n# macOS: ~/Library/Application Support/Claude/claude_desktop_config.json\n# Windows: %APPDATA%/Claude/claude_desktop_config.json\n\n# Cursor\n# Project: .cursor/mcp.json\n# Global: ~/.cursor/mcp.json",
				},
				{
					title: "Use Valid Configuration",
					description: "Start with a minimal working configuration.",
					code: '{\n  "mcpServers": {\n    "memoria": {\n      "command": "npx",\n      "args": ["@byronwade/memoria"]\n    }\n  }\n}',
				},
			],
		},
		relatedIssues: ["mcp-connection"],
	},
	{
		slug: "performance-issues",
		title: "Optimizing Memoria for Large Repositories",
		shortTitle: "Performance Issues",
		description:
			"Speed up Memoria in large repositories with 100k+ files. Configure caching, adjust thresholds, and optimize git operations.",
		icon: Gauge,
		keywords: [
			"slow",
			"performance",
			"large repo",
			"timeout",
			"optimization",
			"cache",
		],
		content: {
			problem:
				"Memoria runs slowly or times out in repositories with many files or long git history.",
			causes: [
				"Repository has many files (100k+)",
				"Long git history (years of commits)",
				"No .gitignore for build artifacts",
				"Analyzing unnecessary directories",
			],
			solutions: [
				{
					title: "Configure Ignore Patterns",
					description:
						"Create a .memoria.json to exclude directories that don't need analysis.",
					code: '{\n  "ignore": [\n    "node_modules",\n    "dist",\n    "build",\n    ".git",\n    "*.min.js",\n    "vendor"\n  ]\n}',
				},
				{
					title: "Limit History Depth",
					description:
						"Reduce the number of commits analyzed for faster results.",
					code: '{\n  "maxCommits": 500,\n  "historyDays": 90\n}',
				},
				{
					title: "Enable Caching",
					description:
						"Memoria caches results by default. Ensure the cache directory is writable.",
					code: '{\n  "cache": {\n    "enabled": true,\n    "ttl": 3600\n  }\n}',
				},
				{
					title: "Run Analysis Off-Peak",
					description:
						"For very large repos, run Memoria's analysis during low-activity periods and use cached results.",
				},
			],
		},
		relatedIssues: ["config-file-errors"],
	},
];

export function getTroubleshootingBySlug(
	slug: string,
): TroubleshootingItem | undefined {
	return troubleshootingItems.find((item) => item.slug === slug);
}

export function getAllTroubleshootingSlugs(): string[] {
	return troubleshootingItems.map((item) => item.slug);
}
