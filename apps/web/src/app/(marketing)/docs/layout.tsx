"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";

const navItems = [
	{ href: "/docs", label: "Overview" },
	{ href: "/docs/installation", label: "Installation" },
	{ href: "/docs/how-it-works", label: "How It Works" },
	{ href: "/docs/features", label: "Features" },
];

const installGuides = [
	{ href: "/docs/installation/claude", label: "Claude Desktop" },
	{ href: "/docs/installation/cursor", label: "Cursor" },
	{ href: "/docs/installation/windsurf", label: "Windsurf" },
	{ href: "/docs/installation/continue", label: "Continue" },
];

const featureGuides = [
	{ href: "/docs/features/volatility-engine", label: "Volatility Engine" },
	{ href: "/docs/features/entanglement-engine", label: "Entanglement Engine" },
	{ href: "/docs/features/sentinel-engine", label: "Sentinel Engine" },
	{
		href: "/docs/features/static-import-engine",
		label: "Static Import Engine",
	},
	{ href: "/docs/features/history-search", label: "History Search" },
];

const advancedGuides = [
	{ href: "/docs/configuration", label: "Configuration" },
	{ href: "/docs/auto-pilot", label: "Auto-Pilot Mode" },
	{ href: "/docs/cli", label: "CLI Reference" },
];

const supportGuides = [
	{ href: "/docs/troubleshooting", label: "All Issues" },
	{
		href: "/docs/troubleshooting/command-not-found",
		label: "Command Not Found",
	},
	{ href: "/docs/troubleshooting/nodejs-version", label: "Node.js Version" },
	{ href: "/docs/troubleshooting/mcp-connection", label: "MCP Connection" },
	{ href: "/docs/troubleshooting/performance-issues", label: "Performance" },
];

export default function DocsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const pathname = usePathname();
	const [mobileNavOpen, setMobileNavOpen] = useState(false);

	useEffect(() => {
		setMobileNavOpen(false);
	}, [pathname]);

	const NavSection = ({
		title,
		items,
		onNavigate,
	}: {
		title: string;
		items: { href: string; label: string }[];
		onNavigate?: () => void;
	}) => (
		<div>
			<h3 className="font-medium mb-4 text-xs uppercase tracking-widest text-muted-foreground">
				{title}
			</h3>
			<ul className="space-y-1">
				{items.map((item) => {
					const isActive = pathname === item.href;
					return (
						<li key={item.href}>
							<Link
								href={item.href}
								onClick={onNavigate}
								className={`block py-2 px-3 -mx-3 rounded-md text-sm transition-colors ${
									isActive
										? "bg-accent/10 text-accent font-medium"
										: "text-muted-foreground hover:text-foreground hover:bg-muted"
								}`}
							>
								{item.label}
							</Link>
						</li>
					);
				})}
			</ul>
		</div>
	);

	const DocsNav = ({ onNavigate }: { onNavigate?: () => void }) => (
		<nav className="space-y-8" aria-label="Documentation">
			<NavSection
				title="Getting Started"
				items={navItems}
				onNavigate={onNavigate}
			/>
			<NavSection
				title="Install Guides"
				items={installGuides}
				onNavigate={onNavigate}
			/>
			<NavSection
				title="Features"
				items={featureGuides}
				onNavigate={onNavigate}
			/>
			<NavSection
				title="Advanced"
				items={advancedGuides}
				onNavigate={onNavigate}
			/>
			<NavSection
				title="Troubleshooting"
				items={supportGuides}
				onNavigate={onNavigate}
			/>
		</nav>
	);

	return (
		<div className="min-h-screen bg-background pt-16">
			<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 flex gap-12 lg:gap-16">
				{/* Mobile docs nav */}
				<div className="md:hidden fixed bottom-4 right-4 z-40">
					<Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
						<SheetTrigger asChild>
							<Button
								variant="outline"
								size="icon"
								className="shadow-lg bg-background"
								aria-label="Open documentation navigation"
							>
								<Menu className="h-5 w-5" />
							</Button>
						</SheetTrigger>
						<SheetContent
							side="left"
							className="w-[280px] sm:max-w-sm overflow-y-auto"
						>
							<SheetHeader>
								<SheetTitle>Documentation</SheetTitle>
							</SheetHeader>
							<div className="px-4 pb-8">
								<DocsNav onNavigate={() => setMobileNavOpen(false)} />
							</div>
						</SheetContent>
					</Sheet>
				</div>

				{/* Desktop sidebar */}
				<aside className="w-56 shrink-0 hidden md:block">
					<div className="sticky top-24">
						<DocsNav />
					</div>
				</aside>

				{/* Main Content */}
				<main className="flex-1 min-w-0 max-w-3xl">{children}</main>
			</div>
		</div>
	);
}
