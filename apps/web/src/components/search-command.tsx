"use client";

import {
	Download,
	FileText,
	Home,
	Layers,
	Search,
	Settings,
	Wrench,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";

interface SearchItem {
	title: string;
	href: string;
	keywords?: string[];
}

const searchData: {
	group: string;
	icon: React.ElementType;
	items: SearchItem[];
}[] = [
	{
		group: "Getting Started",
		icon: Home,
		items: [
			{ title: "Documentation Overview", href: "/docs" },
			{ title: "Installation", href: "/docs/installation" },
			{ title: "How It Works", href: "/docs/how-it-works" },
			{ title: "Features Overview", href: "/docs/features" },
		],
	},
	{
		group: "Install Guides",
		icon: Download,
		items: [
			{
				title: "Claude Desktop",
				href: "/docs/installation/claude",
				keywords: ["claude", "desktop", "anthropic"],
			},
			{
				title: "Cursor",
				href: "/docs/installation/cursor",
				keywords: ["cursor", "ide", "editor"],
			},
			{
				title: "Windsurf",
				href: "/docs/installation/windsurf",
				keywords: ["windsurf", "codeium"],
			},
			{
				title: "Continue",
				href: "/docs/installation/continue",
				keywords: ["continue", "vscode", "extension"],
			},
		],
	},
	{
		group: "Features",
		icon: Layers,
		items: [
			{
				title: "Volatility Engine",
				href: "/docs/features/volatility-engine",
				keywords: ["panic", "bug", "fix", "unstable"],
			},
			{
				title: "Entanglement Engine",
				href: "/docs/features/entanglement-engine",
				keywords: ["coupled", "dependencies", "files"],
			},
			{
				title: "Sentinel Engine",
				href: "/docs/features/sentinel-engine",
				keywords: ["stale", "outdated", "old"],
			},
			{
				title: "Static Import Engine",
				href: "/docs/features/static-import-engine",
				keywords: ["import", "require", "module"],
			},
			{
				title: "History Search",
				href: "/docs/features/history-search",
				keywords: ["git", "history", "search", "commits"],
			},
		],
	},
	{
		group: "Advanced",
		icon: Settings,
		items: [
			{
				title: "Configuration",
				href: "/docs/configuration",
				keywords: ["config", "settings", "options"],
			},
			{
				title: "Auto-Pilot Mode",
				href: "/docs/auto-pilot",
				keywords: ["auto", "automatic", "rules"],
			},
			{
				title: "CLI Reference",
				href: "/docs/cli",
				keywords: ["cli", "command", "terminal"],
			},
			{
				title: "API Reference",
				href: "/docs/api",
				keywords: ["api", "mcp", "tools"],
			},
		],
	},
	{
		group: "Troubleshooting",
		icon: Wrench,
		items: [
			{ title: "All Issues", href: "/docs/troubleshooting" },
			{
				title: "Command Not Found",
				href: "/docs/troubleshooting/command-not-found",
				keywords: ["npx", "path", "not found"],
			},
			{
				title: "Node.js Version",
				href: "/docs/troubleshooting/nodejs-version",
				keywords: ["node", "version", "nvm"],
			},
			{
				title: "MCP Connection",
				href: "/docs/troubleshooting/mcp-connection",
				keywords: ["connection", "server", "client"],
			},
			{
				title: "Performance Issues",
				href: "/docs/troubleshooting/performance-issues",
				keywords: ["slow", "performance", "speed"],
			},
		],
	},
	{
		group: "Resources",
		icon: FileText,
		items: [
			{
				title: "Security",
				href: "/docs/security",
				keywords: ["security", "privacy", "data"],
			},
			{
				title: "Changelog",
				href: "/docs/changelog",
				keywords: ["changelog", "updates", "releases"],
			},
			{
				title: "Contributing",
				href: "/docs/contributing",
				keywords: ["contribute", "github", "open source"],
			},
		],
	},
	{
		group: "Homepage",
		icon: Home,
		items: [
			{ title: "Features Section", href: "/#features" },
			{ title: "How It Works Section", href: "/#how-it-works" },
		],
	},
];

interface SearchCommandProps {
	variant?: "default" | "mobile";
}

export function SearchCommand({ variant = "default" }: SearchCommandProps) {
	const [open, setOpen] = useState(false);
	const router = useRouter();

	useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				setOpen((open) => !open);
			}
		};

		document.addEventListener("keydown", down);
		return () => document.removeEventListener("keydown", down);
	}, []);

	const runCommand = useCallback((command: () => void) => {
		setOpen(false);
		command();
	}, []);

	return (
		<>
			<button
				onClick={() => setOpen(true)}
				className={
					variant === "mobile"
						? "flex items-center justify-center w-9 h-9 text-muted-foreground hover:text-foreground transition-colors rounded-md"
						: "flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md border border-card-border hover:border-foreground/20 bg-background/50"
				}
				aria-label="Search documentation"
			>
				<Search className="w-4 h-4" />
				{variant === "default" && (
					<>
						<span className="hidden lg:inline">Search</span>
						<kbd className="hidden lg:inline-flex h-5 items-center gap-1 rounded border border-card-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
							<span className="text-xs">⌘</span>K
						</kbd>
					</>
				)}
			</button>
			<CommandDialog open={open} onOpenChange={setOpen}>
				<CommandInput placeholder="Search documentation..." />
				<CommandList>
					<CommandEmpty>No results found.</CommandEmpty>
					{searchData.map((group, index) => (
						<CommandGroup key={group.group} heading={group.group}>
							{group.items.map((item) => (
								<CommandItem
									key={item.href}
									value={`${item.title} ${item.keywords?.join(" ") || ""}`}
									onSelect={() => runCommand(() => router.push(item.href))}
								>
									<group.icon className="mr-2 h-4 w-4" />
									<span>{item.title}</span>
								</CommandItem>
							))}
						</CommandGroup>
					))}
				</CommandList>
			</CommandDialog>
		</>
	);
}
