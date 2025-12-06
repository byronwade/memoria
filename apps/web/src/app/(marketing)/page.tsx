"use client";

import { m } from "framer-motion";
import {
	ArrowRight,
	Check,
	ChevronRight,
	Copy,
	Flame,
	GitBranch,
	Github,
	Link2,
	Search,
	Shield,
	Zap,
	AlertTriangle,
	FileText,
	Code,
	FileCode,
	TestTube,
	Settings,
	Database,
	Globe,
	Share2,
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/layout/section";
import { siteConfig } from "@/lib/seo/constants";
import { cn } from "@/lib/utils";

// Animation variants
const fadeInUp = {
	hidden: { opacity: 0, y: 20 },
	visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const staggerContainer = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: { staggerChildren: 0.1 },
	},
};

// Show the real disaster: a broken PR scenario
function DependencyGraph() {
	const [step, setStep] = useState(0);

	useEffect(() => {
		const timers = [
			setTimeout(() => setStep(1), 500),
			setTimeout(() => setStep(2), 1500),
			setTimeout(() => setStep(3), 2500),
			setTimeout(() => setStep(4), 3500),
		];
		return () => timers.forEach(clearTimeout);
	}, []);

	return (
		<div className="w-full h-full flex items-center justify-center p-4">
			<div className="w-full max-w-md space-y-3">
				{/* Git commit message */}
				{step >= 1 && (
					<m.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						className="font-mono text-sm"
					>
						<div className="flex items-center gap-2 text-muted-foreground mb-1">
							<GitBranch className="w-4 h-4" />
							<span>main</span>
							<span className="text-muted-foreground/50">•</span>
							<span>2 minutes ago</span>
						</div>
						<div className="pl-6 border-l-2 border-green-500 py-1">
							<span className="text-green-500">feat:</span> refactor getUserById to async
						</div>
					</m.div>
				)}

				{/* CI Status */}
				{step >= 2 && (
					<m.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						className="flex items-center gap-3 py-2"
					>
						<div className="flex items-center gap-2">
							<div className="w-2 h-2 rounded-full bg-green-500" />
							<span className="text-sm text-green-500">CI passed</span>
						</div>
						<div className="flex items-center gap-2">
							<div className="w-2 h-2 rounded-full bg-green-500" />
							<span className="text-sm text-green-500">Tests passed</span>
						</div>
						<div className="flex items-center gap-2">
							<Check className="w-4 h-4 text-green-500" />
							<span className="text-sm text-green-500">Merged</span>
						</div>
					</m.div>
				)}

				{/* The disaster */}
				{step >= 3 && (
					<m.div
						initial={{ opacity: 0, scale: 0.95 }}
						animate={{ opacity: 1, scale: 1 }}
						className="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30"
					>
						<div className="flex items-start gap-3">
							<div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
								<AlertTriangle className="w-5 h-5 text-red-500" />
							</div>
							<div className="space-y-2">
								<div className="font-semibold text-red-500">Production incident #847</div>
								<div className="text-sm text-muted-foreground">
									<span className="text-foreground">api/users/route.ts</span> still calls the old sync version.
									<br />
									<span className="text-foreground">UserService.test.ts</span> wasn't updated — tests lied.
									<br />
									<span className="text-foreground">ProfileCard.tsx</span> crashes on undefined.
								</div>
								<div className="text-xs text-red-400 pt-1">
									3 files silently broke. No imports linked them.
								</div>
							</div>
						</div>
					</m.div>
				)}

				{/* The solution */}
				{step >= 4 && (
					<m.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/20"
					>
						<div className="text-sm">
							<span className="text-primary font-semibold">With Memoria:</span>
							<span className="text-muted-foreground"> Your AI would have seen these 3 files are </span>
							<span className="text-foreground font-medium">85% coupled</span>
							<span className="text-muted-foreground"> and updated them together.</span>
						</div>
					</m.div>
				)}
			</div>
		</div>
	);
}

// Copy command component
function CopyCommand({ command }: { command: string }) {
	const [copied, setCopied] = useState(false);

	const copy = async () => {
		await navigator.clipboard.writeText(command);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<button
			onClick={copy}
			className="flex items-center gap-3 px-4 py-3 bg-foreground text-background rounded-lg font-mono text-sm hover:bg-foreground/90 transition-colors group cursor-pointer"
		>
			<span className="text-background/60">$</span>
			<span>{command}</span>
			{copied ? (
				<Check className="w-4 h-4 text-green-400" />
			) : (
				<Copy className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
			)}
		</button>
	);
}

// Animated typing text component
function TypedText({ text, delay = 0, speed = 30 }: { text: string; delay?: number; speed?: number }) {
	const [displayedText, setDisplayedText] = useState("");
	const [started, setStarted] = useState(false);

	useEffect(() => {
		const startTimer = setTimeout(() => setStarted(true), delay);
		return () => clearTimeout(startTimer);
	}, [delay]);

	useEffect(() => {
		if (!started) return;

		let index = 0;
		const interval = setInterval(() => {
			if (index <= text.length) {
				setDisplayedText(text.slice(0, index));
				index++;
			} else {
				clearInterval(interval);
			}
		}, speed);

		return () => clearInterval(interval);
	}, [started, text, speed]);

	return (
		<span>
			{displayedText}
			{started && displayedText.length < text.length && (
				<span className="animate-pulse">|</span>
			)}
		</span>
	);
}

// Animated conversation line
function ConversationLine({
	speaker,
	message,
	delay,
	isHighlight = false,
	highlightColor = "text-primary",
}: {
	speaker: string;
	message: string;
	delay: number;
	isHighlight?: boolean;
	highlightColor?: string;
}) {
	return (
		<m.div
			className="flex gap-3"
			initial={{ opacity: 0, x: -10 }}
			whileInView={{ opacity: 1, x: 0 }}
			viewport={{ once: true }}
			transition={{ delay, duration: 0.3 }}
		>
			<span className="text-muted-foreground w-20 shrink-0 font-medium">{speaker}</span>
			<span className={isHighlight ? `${highlightColor} font-semibold` : ""}>{message}</span>
		</m.div>
	);
}

// FAQ Item component
function FAQItem({ question, answer, isOpen, onClick }: { question: string; answer: string; isOpen: boolean; onClick: () => void }) {
	return (
		<div className="border-b border-border/50 last:border-0">
			<button
				onClick={onClick}
				className="flex items-center justify-between w-full py-5 text-left cursor-pointer group"
			>
				<span className="font-medium text-foreground group-hover:text-primary transition-colors pr-4">{question}</span>
				<m.div
					animate={{ rotate: isOpen ? 180 : 0 }}
					transition={{ duration: 0.2 }}
					className="shrink-0"
				>
					<ChevronRight className={cn("w-5 h-5 rotate-90 transition-colors", isOpen ? "text-primary" : "text-muted-foreground")} />
				</m.div>
			</button>
			<m.div
				initial={false}
				animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
				transition={{ duration: 0.3 }}
				className="overflow-hidden"
			>
				<p className="pb-5 text-muted-foreground leading-relaxed">{answer}</p>
			</m.div>
		</div>
	);
}

// The 13 engines
const engines = [
	{
		icon: Flame,
		title: "Volatility Engine",
		description: "Scans commits for panic keywords with time-decay. Recent bugs matter more.",
		metric: "~10ms",
	},
	{
		icon: Link2,
		title: "Entanglement Engine",
		description: "Finds files that change together >15% of the time.",
		metric: "~45ms",
	},
	{
		icon: Shield,
		title: "Sentinel Engine",
		description: "Detects when coupled files are >7 days out of sync.",
		metric: "<1ms",
	},
	{
		icon: GitBranch,
		title: "Static Import Engine",
		description: "Uses git grep to find files that import the target.",
		metric: "~8ms",
	},
	{
		icon: Search,
		title: "History Search",
		description: "Search git history to understand WHY code was written.",
		metric: "~7ms",
	},
	{
		icon: FileText,
		title: "Documentation Coupling",
		description: "Finds markdown files referencing your exported functions and types.",
		metric: "~50ms",
	},
	{
		icon: Code,
		title: "Type Coupling",
		description: "Discovers files sharing type definitions via git pickaxe search.",
		metric: "~100ms",
	},
	{
		icon: FileCode,
		title: "Content Coupling",
		description: "Detects files sharing string literals like error messages and constants.",
		metric: "~30ms",
	},
	{
		icon: TestTube,
		title: "Test File Coupling",
		description: "Auto-discovers test and mock files matching source file naming patterns.",
		metric: "~20ms",
	},
	{
		icon: Settings,
		title: "Environment Coupling",
		description: "Finds files sharing the same environment variables (ALL_CAPS_UNDERSCORE).",
		metric: "~15ms",
	},
	{
		icon: Database,
		title: "Schema Coupling",
		description: "Detects files affected by database schema or model changes.",
		metric: "~25ms",
	},
	{
		icon: Globe,
		title: "API Endpoint Coupling",
		description: "Finds client code calling API endpoints defined in the target file.",
		metric: "~30ms",
	},
	{
		icon: Share2,
		title: "Transitive Coupling",
		description: "Discovers files affected through barrel/index re-exports.",
		metric: "~40ms",
	},
];

// Supported tools with logos from Simple Icons (simpleicons.org)
const supportedTools = [
	{
		name: "Claude",
		logo: (
			<svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
				<path d="M17.304 3.541h-3.672l6.696 16.918H24l-6.696-16.918Zm-6.768 0L0 20.459h3.744l1.37-3.553h7.005l1.369 3.553h3.744L10.536 3.541Zm-.371 10.223 2.291-5.946 2.292 5.946H10.165Z"/>
			</svg>
		),
	},
	{
		name: "Cursor",
		logo: (
			<svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
				<path d="M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23"/>
			</svg>
		),
	},
	{
		name: "Windsurf",
		logo: (
			<svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
				<path d="M23.55 5.067c-1.204-.002-2.18.973-2.18 2.177v4.867c0 .972-.804 1.76-1.76 1.76-.568 0-1.135-.286-1.472-.766l-4.971-7.1c-.413-.59-1.084-.941-1.81-.941-1.134 0-2.154.963-2.154 2.153v4.896c0 .972-.797 1.759-1.76 1.759-.57 0-1.136-.286-1.472-.766L.408 5.16C.282 4.98 0 5.069 0 5.288v4.245c0 .215.066.423.188.6l5.475 7.818c.323.462.8.805 1.35.93 1.378.313 2.645-.747 2.645-2.098v-4.893c0-.972.788-1.76 1.76-1.76h.003c.57 0 1.136.287 1.472.766l4.972 7.1c.414.59 1.05.94 1.81.94 1.158 0 2.151-.964 2.151-2.153v-4.895c0-.972.788-1.759 1.76-1.759h.194a.22.22 0 0 0 .22-.22V5.287a.22.22 0 0 0-.22-.22Z"/>
			</svg>
		),
	},
	{
		name: "VS Code",
		logo: (
			<svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
				<path d="M23.15 2.587 18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z"/>
			</svg>
		),
	},
	{
		name: "GitHub",
		logo: (
			<svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
				<path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
			</svg>
		),
	},
	{
		name: "Any MCP",
		logo: (
			<svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
				<circle cx="12" cy="12" r="3"/>
				<path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>
			</svg>
		),
	},
];

// Mock risk distribution for demo
const riskDistribution = { critical: 3, high: 12, medium: 45, low: 89 };
const totalRiskFiles = riskDistribution.critical + riskDistribution.high + riskDistribution.medium + riskDistribution.low;

// FAQ data
const faqs = [
	{
		question: "How does Memoria work with my AI coding assistant?",
		answer: "Memoria runs as an MCP (Model Context Protocol) server that your AI assistant connects to. When you edit a file, your AI calls Memoria's analyze_file tool to get risk scores, coupled files, and a pre-flight checklist. This takes ~150ms and gives your AI context it couldn't get otherwise.",
	},
	{
		question: "Does Memoria slow down my development workflow?",
		answer: "Not at all. Memoria analyzes files in about 150ms total. It uses smart caching (5-minute TTL) so repeated analyses of the same file are instant. The analysis runs in the background while you work.",
	},
	{
		question: "What AI tools does Memoria support?",
		answer: "Memoria works with any AI tool that supports MCP: Claude Desktop, Claude Code, Cursor, Windsurf, Continue, Cline, and more. If your tool supports MCP servers, it supports Memoria.",
	},
	{
		question: "Is my code sent to external servers?",
		answer: "No. Memoria runs entirely locally on your machine. It analyzes your git history and file imports without sending any code to external servers. Your code never leaves your computer.",
	},
	{
		question: "What does the risk score mean?",
		answer: "The risk score (0-100) combines four factors: file volatility (how often it's been buggy), coupling strength (how many files change with it), drift (how stale coupled files are), and import count (how many files depend on it). Higher scores mean more caution is needed.",
	},
	{
		question: "Can I customize Memoria's behavior?",
		answer: "Yes! Create a .memoria.json file in your repo to customize thresholds, add custom panic keywords, adjust risk weights, and ignore specific patterns. Check the docs for all configuration options.",
	},
];


export default function Home() {
	const [hoveredRiskSegment, setHoveredRiskSegment] = useState<string | null>(null);
	const [openFAQ, setOpenFAQ] = useState<number | null>(0);

	return (
		<div className="min-h-screen bg-background text-foreground">
			{/* Hero Section - Clean Minimalist Design */}
			<section className="relative min-h-[90vh] flex items-center">
				<Container size="lg">
					<div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
						{/* Left: Content */}
						<div className="max-w-xl">
							{/* Badge */}
							<m.div
								className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm text-primary mb-6"
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.5 }}
							>
								<Shield className="w-4 h-4" />
								<span>Stop breaking production</span>
							</m.div>

							{/* Main headline */}
							<m.h1
								className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]"
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.5, delay: 0.1 }}
							>
								Your AI has
								<br />
								<span className="relative">
									<span className="text-primary">amnesia</span>
									<m.span
										className="absolute -bottom-2 left-0 right-0 h-1 bg-primary/30 rounded-full"
										initial={{ scaleX: 0 }}
										animate={{ scaleX: 1 }}
										transition={{ duration: 0.5, delay: 0.6 }}
									/>
								</span>
							</m.h1>

							{/* Subheadline */}
							<m.p
								className="mt-6 text-lg sm:text-xl text-muted-foreground leading-relaxed"
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.5, delay: 0.2 }}
							>
								It sees the file you're editing but has{" "}
								<span className="text-foreground font-medium">zero awareness</span>{" "}
								of the 8 files that will break when you change it.
							</m.p>

							{/* Value prop list */}
							<m.div
								className="mt-8 space-y-3"
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.5, delay: 0.3 }}
							>
								{[
									"Reveals hidden file dependencies through git forensics",
									"Calculates risk scores before you touch a file",
									"Works with any AI coding assistant",
								].map((item, i) => (
									<div key={i} className="flex items-start gap-3">
										<div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center mt-0.5 shrink-0">
											<Check className="w-3 h-3 text-primary" />
										</div>
										<span className="text-muted-foreground">{item}</span>
									</div>
								))}
							</m.div>

							{/* CTA Buttons */}
							<m.div
								className="mt-10 flex flex-col sm:flex-row items-start gap-3"
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.5, delay: 0.4 }}
							>
								<Button variant="cta" size="lg" className="text-base px-6" asChild>
									<Link href="/pricing">
										Start free trial
										<ArrowRight className="w-4 h-4 ml-2" />
									</Link>
								</Button>
								<Button variant="outline" size="lg" className="text-base" asChild>
									<Link href="/docs">View docs</Link>
								</Button>
							</m.div>

							{/* Quick install */}
							<m.div
								className="mt-6"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{ duration: 0.5, delay: 0.5 }}
							>
								<CopyCommand command="npx -y @byronwade/memoria" />
							</m.div>
						</div>

						{/* Right: Dependency Graph - Minimal, directly on background */}
						<m.div
							className="relative h-[400px] lg:h-[480px]"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ duration: 0.8, delay: 0.3 }}
						>
							<DependencyGraph />
						</m.div>
					</div>
				</Container>
			</section>

			{/* Trusted By / Works With Section */}
			<Section className="py-12 border-b border-border/50">
				<Container>
					<m.div
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						className="text-center"
					>
						<p className="text-sm text-muted-foreground mb-8">
							Works seamlessly with your favorite AI tools
						</p>
						<div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
							{supportedTools.map((tool, i) => (
								<m.div
									key={tool.name}
									initial={{ opacity: 0, y: 10 }}
									whileInView={{ opacity: 1, y: 0 }}
									viewport={{ once: true }}
									transition={{ delay: i * 0.05 }}
									className="flex items-center gap-2.5 text-muted-foreground/60 hover:text-foreground transition-colors cursor-default group"
								>
									<div className="text-muted-foreground/40 group-hover:text-foreground transition-colors">
										{tool.logo}
									</div>
									<span className="text-sm font-medium">{tool.name}</span>
								</m.div>
							))}
						</div>
					</m.div>
				</Container>
			</Section>

			{/* Live Stats Section */}
			<Section className="py-16">
				<Container size="lg">
					<m.div
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						className="max-w-5xl mx-auto"
					>
						{/* Section header */}
						<div className="text-center mb-12">
							<h2 className="text-3xl md:text-4xl font-bold tracking-tight">
								Numbers that matter
							</h2>
							<p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
								See how Memoria prevents production incidents before they happen
							</p>
						</div>

						{/* Stats grid */}
						<div className="grid md:grid-cols-3 gap-8">
							<m.div
								className="text-center p-8 rounded-2xl bg-gradient-to-b from-green-500/10 to-transparent border border-green-500/20"
								whileHover={{ scale: 1.02 }}
								transition={{ type: "spring", stiffness: 300 }}
							>
								<div className="text-5xl font-bold text-green-500 mb-2">423</div>
								<div className="text-lg font-medium text-foreground">Issues Prevented</div>
								<div className="text-sm text-muted-foreground mt-1">This month alone</div>
							</m.div>
							<m.div
								className="text-center p-8 rounded-2xl bg-gradient-to-b from-primary/10 to-transparent border border-primary/20"
								whileHover={{ scale: 1.02 }}
								transition={{ type: "spring", stiffness: 300 }}
							>
								<div className="text-5xl font-bold text-primary mb-2">~150ms</div>
								<div className="text-lg font-medium text-foreground">Analysis Time</div>
								<div className="text-sm text-muted-foreground mt-1">Full file forensics</div>
							</m.div>
							<m.div
								className="text-center p-8 rounded-2xl bg-gradient-to-b from-orange-500/10 to-transparent border border-orange-500/20"
								whileHover={{ scale: 1.02 }}
								transition={{ type: "spring", stiffness: 300 }}
							>
								<div className="text-5xl font-bold text-orange-500 mb-2">34</div>
								<div className="text-lg font-medium text-foreground">Avg Risk Score</div>
								<div className="text-sm text-muted-foreground mt-1">Across all analyses</div>
							</m.div>
						</div>

						{/* Risk Distribution */}
						<div className="mt-12 p-6 rounded-2xl bg-card border border-border/50">
							<div className="flex items-center justify-between mb-4">
								<div className="text-sm font-medium text-foreground">Risk Distribution</div>
								<div className="text-sm text-muted-foreground">{totalRiskFiles} files analyzed</div>
							</div>
							<div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
								<div className="flex-1 h-4 rounded-full overflow-hidden flex bg-muted/30">
									{[
										{ key: "critical", color: "bg-red-500", count: riskDistribution.critical },
										{ key: "high", color: "bg-orange-500", count: riskDistribution.high },
										{ key: "medium", color: "bg-yellow-500", count: riskDistribution.medium },
										{ key: "low", color: "bg-primary", count: riskDistribution.low },
									].map((item) => (
										<div
											key={item.key}
											className={cn(
												item.color,
												"transition-all cursor-pointer hover:brightness-110"
											)}
											style={{ width: `${(item.count / totalRiskFiles) * 100}%` }}
											onMouseEnter={() => setHoveredRiskSegment(item.key)}
											onMouseLeave={() => setHoveredRiskSegment(null)}
										/>
									))}
								</div>
								<div className="flex items-center gap-4 text-xs shrink-0 flex-wrap">
									{[
										{ key: "critical", color: "bg-red-500", label: "Critical" },
										{ key: "high", color: "bg-orange-500", label: "High" },
										{ key: "medium", color: "bg-yellow-500", label: "Medium" },
										{ key: "low", color: "bg-primary", label: "Low" },
									].map((item) => (
										<div
											key={item.key}
											className="flex items-center gap-1.5"
										>
											<div className={cn("w-3 h-3 rounded-full", item.color)} />
											<span className="text-muted-foreground">{item.label}</span>
											<span className="font-medium text-foreground">
												{riskDistribution[item.key as keyof typeof riskDistribution]}
											</span>
										</div>
									))}
								</div>
							</div>
						</div>
					</m.div>
				</Container>
			</Section>

			{/* Terminal Demo - Dashboard Card Style */}
			<Section className="py-16">
				<Container size="lg">
					<m.div
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						className="max-w-4xl mx-auto"
					>
						<div className="overflow-hidden rounded-sm border border-border/50 bg-foreground shadow-2xl">
							{/* Terminal header */}
							<div className="flex items-center gap-2 px-4 py-3 border-b border-background/10">
								<div className="flex gap-1.5">
									<div className="w-3 h-3 rounded-full bg-red-500" />
									<div className="w-3 h-3 rounded-full bg-yellow-500" />
									<div className="w-3 h-3 rounded-full bg-green-500" />
								</div>
								<span className="text-background/60 text-sm font-mono ml-2">memoria output</span>
							</div>

							{/* Terminal content */}
							<div className="p-6 font-mono text-sm text-background/90">
								<div className="text-background font-bold text-base mb-3">
									Forensics for `route.ts`
								</div>
								<div className="text-red-400 font-semibold">
									RISK: 65/100 (HIGH)
								</div>
								<div className="text-background/60 text-xs mt-1 mb-4">
									High volatility (45%) • Tightly coupled (5 files) • 8 dependents
								</div>

								<div className="text-primary font-semibold mt-4">COUPLED FILES</div>
								<div className="text-blue-400 mt-2">`billing/page.tsx` — 85% [schema]</div>
								<div className="text-background/50 italic pl-4 border-l-2 border-background/20 my-2">
									References: billing_records table. Schema changes may break queries.
								</div>
								<div className="text-green-400 mt-2">`route.test.ts` — 90% [test]</div>
								<div className="text-background/50 italic pl-4 border-l-2 border-background/20 my-2">
									Test file matches naming pattern. Update when changing exports.
								</div>
								<div className="text-cyan-400 mt-2">`config.ts` — 75% [env]</div>
								<div className="text-background/50 italic pl-4 border-l-2 border-background/20 my-2">
									Shares env vars: STRIPE_KEY, DATABASE_URL
								</div>
								<div className="text-purple-400 mt-2">`hooks/usePayment.ts` — 65% [api]</div>
								<div className="text-background/50 italic pl-4 border-l-2 border-background/20 my-2">
									Calls endpoint: POST /api/billing/charge
								</div>
								<div className="text-orange-400 mt-2">`features/index.ts` — [transitive]</div>
								<div className="text-background/50 italic pl-4 border-l-2 border-background/20 my-2">
									Re-exports this file. 12 transitive importers affected.
								</div>

								<div className="text-primary font-semibold mt-4">PRE-FLIGHT CHECKLIST</div>
								<div className="text-background/70 pl-4 mt-2 space-y-1">
									<div>- [ ] Modify `route.ts`</div>
									<div>- [ ] Verify `billing/page.tsx` [schema]</div>
									<div>- [ ] Update `route.test.ts` [test]</div>
									<div>- [ ] Check `hooks/usePayment.ts` [api]</div>
								</div>
							</div>
						</div>

						{/* Badges */}
						<div className="mt-6 flex items-center justify-center gap-4 flex-wrap">
							<a
								href="https://www.npmjs.com/package/@byronwade/memoria"
								target="_blank"
								rel="noopener noreferrer"
							>
								<img
									src="https://img.shields.io/npm/v/@byronwade/memoria.svg"
									alt="npm version"
									className="h-5"
								/>
							</a>
							<a
								href="https://github.com/byronwade/memoria"
								target="_blank"
								rel="noopener noreferrer"
							>
								<img
									src="https://img.shields.io/github/stars/byronwade/memoria?style=social"
									alt="GitHub stars"
									className="h-5"
								/>
							</a>
							<a
								href="https://smithery.ai/server/@byronwade/memoria"
								target="_blank"
								rel="noopener noreferrer"
							>
								<img
									src="https://smithery.ai/badge/@byronwade/memoria"
									alt="Smithery"
									className="h-5"
								/>
							</a>
						</div>
					</m.div>
				</Container>
			</Section>

			{/* Before/After Comparison - Animated Conversation */}
			<Section className="py-20 bg-muted/30 overflow-hidden">
				<Container size="lg">
					<m.div
						className="text-center mb-16"
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
					>
						<m.div
							variants={fadeInUp}
							className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-sm text-red-500 mb-6"
						>
							<AlertTriangle className="w-4 h-4" />
							<span>The problem</span>
						</m.div>
						<m.h2
							variants={fadeInUp}
							className="text-3xl md:text-4xl font-bold tracking-tight"
						>
							Why does your AI keep breaking things?
						</m.h2>
						<m.p
							variants={fadeInUp}
							className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto"
						>
							AI assistants are goldfish. They see the file you're editing but have{" "}
							<span className="text-foreground font-medium">zero awareness</span> of hidden dependencies.
						</m.p>
					</m.div>

					<div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
						{/* Without Memoria */}
						<m.div
							initial={{ opacity: 0, y: 20 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							className="relative"
						>
							<div className="absolute -inset-1 bg-gradient-to-b from-red-500/20 to-transparent rounded-2xl blur-xl" />
							<div className="relative p-8 rounded-2xl border border-red-500/30 bg-card">
								<div className="flex items-center gap-3 mb-6">
									<div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
										<span className="text-red-500 text-xl">✕</span>
									</div>
									<div>
										<div className="font-semibold text-foreground">Without Memoria</div>
										<div className="text-xs text-muted-foreground">Blind to dependencies</div>
									</div>
								</div>
								<div className="space-y-4 font-mono text-sm">
									<ConversationLine speaker="You:" message='"Update the payment route"' delay={0} />
									<ConversationLine speaker="AI:" message='"Done! Updated route.ts ✅"' delay={0.2} />
									<m.div
										className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20"
										initial={{ opacity: 0, scale: 0.95 }}
										whileInView={{ opacity: 1, scale: 1 }}
										viewport={{ once: true }}
										transition={{ delay: 0.4 }}
									>
										<AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
										<span className="text-red-500 font-semibold">TypeError: billing.tsx - Cannot read property 'amount'</span>
									</m.div>
									<ConversationLine speaker="You:" message={'"Wait, what? I didn\'t touch billing..."'} delay={0.6} />
								</div>
								<m.div
									className="mt-6 pt-6 border-t border-border/50 flex items-center gap-3 text-sm text-muted-foreground"
									initial={{ opacity: 0 }}
									whileInView={{ opacity: 1 }}
									viewport={{ once: true }}
									transition={{ delay: 0.8 }}
								>
									<div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
									<span>3 files broken • 45 minutes debugging</span>
								</m.div>
							</div>
						</m.div>

						{/* With Memoria */}
						<m.div
							initial={{ opacity: 0, y: 20 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ delay: 0.2 }}
							className="relative"
						>
							<div className="absolute -inset-1 bg-gradient-to-b from-green-500/20 to-transparent rounded-2xl blur-xl" />
							<div className="relative p-8 rounded-2xl border border-green-500/30 bg-card">
								<div className="flex items-center gap-3 mb-6">
									<div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
										<Check className="w-5 h-5 text-green-500" />
									</div>
									<div>
										<div className="font-semibold text-foreground">With Memoria</div>
										<div className="text-xs text-muted-foreground">Full context awareness</div>
									</div>
								</div>
								<div className="space-y-4 font-mono text-sm">
									<ConversationLine speaker="You:" message='"Update the payment route"' delay={0} />
									<m.div
										className="flex items-start gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20"
										initial={{ opacity: 0, scale: 0.95 }}
										whileInView={{ opacity: 1, scale: 1 }}
										viewport={{ once: true }}
										transition={{ delay: 0.2 }}
									>
										<Shield className="w-4 h-4 text-primary shrink-0 mt-0.5" />
										<div className="text-primary">
											<div className="font-semibold">Memoria Alert</div>
											<div className="text-xs opacity-80">route.ts is 85% coupled with billing.tsx, stripe.ts</div>
										</div>
									</m.div>
									<ConversationLine speaker="AI:" message={'"I\'ll update route.ts AND the coupled files"'} delay={0.4} />
									<ConversationLine speaker="Result:" message="All tests passing ✓" delay={0.6} isHighlight highlightColor="text-green-500" />
								</div>
								<m.div
									className="mt-6 pt-6 border-t border-border/50 flex items-center gap-3 text-sm text-muted-foreground"
									initial={{ opacity: 0 }}
									whileInView={{ opacity: 1 }}
									viewport={{ once: true }}
									transition={{ delay: 0.8 }}
								>
									<div className="w-2 h-2 rounded-full bg-green-500" />
									<span>0 bugs • Shipped in 5 minutes</span>
								</m.div>
							</div>
						</m.div>
					</div>
				</Container>
			</Section>

			{/* 5 Engines Section - Visual Hierarchy */}
			<Section className="py-20">
				<Container>
					<m.div
						className="text-center mb-16"
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
					>
						<m.div
							variants={fadeInUp}
							className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm text-primary mb-6"
						>
							<Zap className="w-4 h-4" />
							<span>Under the hood</span>
						</m.div>
						<m.h2
							variants={fadeInUp}
							className="text-3xl md:text-4xl font-bold tracking-tight"
						>
							Thirteen engines working in parallel
						</m.h2>
						<m.p
							variants={fadeInUp}
							className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto"
						>
							Memoria pre-computes what AI cannot do efficiently—giving your assistant
							the intuition of a senior developer who's been on the project for years.
						</m.p>
					</m.div>

					{/* Bento grid layout */}
					<div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
						{engines.map((engine, i) => (
							<m.div
								key={engine.title}
								initial={{ opacity: 0, y: 20 }}
								whileInView={{ opacity: 1, y: 0 }}
								viewport={{ once: true }}
								transition={{ delay: i * 0.05 }}
								whileHover={{ y: -4 }}
								className={cn(
									"group relative p-6 rounded-2xl border bg-card overflow-hidden transition-all duration-300",
									"hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
								)}
							>
								{/* Subtle gradient on hover */}
								<div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

								<div className="relative">
									<div className="flex items-start justify-between mb-4">
										<div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
											<engine.icon className="w-6 h-6 text-primary" />
										</div>
										<span className="text-xs font-mono text-primary/80 bg-primary/10 px-2.5 py-1 rounded-full">
											{engine.metric}
										</span>
									</div>
									<h3 className="text-lg font-semibold text-foreground mb-2">{engine.title}</h3>
									<p className="text-muted-foreground text-sm leading-relaxed">{engine.description}</p>
								</div>
							</m.div>
						))}
					</div>

					{/* Performance note */}
					<m.div
						className="mt-12 text-center"
						initial={{ opacity: 0 }}
						whileInView={{ opacity: 1 }}
						viewport={{ once: true }}
					>
						<p className="text-sm text-muted-foreground">
							Total analysis time: <span className="text-primary font-semibold">~150ms</span> — all engines run in parallel
						</p>
					</m.div>
				</Container>
			</Section>

			
			{/* Quick Start - Dashboard Style */}
			<Section className="py-16">
				<Container size="lg">
					<m.div
						className="max-w-4xl mx-auto"
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
					>
						<m.div variants={fadeInUp} className="text-center mb-10">
							<h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
								Get started in seconds
							</h2>
							<p className="mt-4 text-lg text-muted-foreground">
								One config change. Zero API keys. Works immediately.
							</p>
						</m.div>

						<m.div variants={fadeInUp}>
							<div className="overflow-hidden rounded-sm border border-border/50 shadow-xl">
								{/* Tab bar */}
								<div className="flex items-center gap-1 px-4 py-3 bg-muted/50 border-b border-border">
									<div className="flex gap-1.5 mr-4">
										<div className="w-3 h-3 rounded-full bg-red-500/80" />
										<div className="w-3 h-3 rounded-full bg-yellow-500/80" />
										<div className="w-3 h-3 rounded-full bg-green-500/80" />
									</div>
									<div className="flex gap-1">
										<span className="px-3 py-1.5 text-xs font-medium bg-background rounded-sm text-foreground">
											mcp.json
										</span>
									</div>
								</div>

								{/* Code content */}
								<div className="p-6 bg-foreground">
									<pre className="text-sm text-background font-mono overflow-x-auto leading-relaxed">
										<code>
											<span className="text-background/50">{"{"}</span>{"\n"}
											<span className="text-background/50">{"  "}"mcpServers"</span><span className="text-background/50">: {"{"}</span>{"\n"}
											<span className="text-primary">{"    "}"memoria"</span><span className="text-background/50">: {"{"}</span>{"\n"}
											<span className="text-background/80">{"      "}"command"</span><span className="text-background/50">:</span> <span className="text-green-400">"npx"</span><span className="text-background/50">,</span>{"\n"}
											<span className="text-background/80">{"      "}"args"</span><span className="text-background/50">:</span> <span className="text-background/50">[</span><span className="text-green-400">"-y"</span><span className="text-background/50">,</span> <span className="text-green-400">"@byronwade/memoria"</span><span className="text-background/50">]</span>{"\n"}
											<span className="text-background/50">{"    }"}</span>{"\n"}
											<span className="text-background/50">{"  }"}</span>{"\n"}
											<span className="text-background/50">{"}"}</span>
										</code>
									</pre>
								</div>

								{/* Bottom bar */}
								<div className="flex items-center justify-between px-6 py-4 bg-foreground border-t border-background/10">
									<div className="flex items-center gap-2 text-background/60 text-sm">
										<Check className="w-4 h-4 text-green-400" />
										<span>Restart your AI tool after adding this</span>
									</div>
									<Button
										size="sm"
										variant="secondary"
										className="bg-background/10 hover:bg-background/20 text-background border-0"
										onClick={() => {
											navigator.clipboard.writeText(`{
  "mcpServers": {
    "memoria": {
      "command": "npx",
      "args": ["-y", "@byronwade/memoria"]
    }
  }
}`);
										}}
									>
										<Copy className="w-4 h-4 mr-2" />
										Copy
									</Button>
								</div>
							</div>
						</m.div>

						{/* Alternative methods */}
						<m.div variants={fadeInUp} className="mt-6 text-center">
							<p className="text-sm text-muted-foreground mb-3">Or install with:</p>
							<div className="flex flex-wrap justify-center gap-3">
								<code className="px-4 py-2 bg-secondary/50 border border-border/50 rounded-sm text-sm font-mono text-foreground">
									claude mcp add memoria
								</code>
								<code className="px-4 py-2 bg-secondary/50 border border-border/50 rounded-sm text-sm font-mono text-foreground">
									npm i -g @byronwade/memoria
								</code>
							</div>
						</m.div>

						{/* CTA */}
						<m.div variants={fadeInUp} className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
							<Button variant="cta" size="lg" asChild>
								<Link href="/docs/installation">
									Full installation guide
									<ArrowRight className="w-4 h-4 ml-2" />
								</Link>
							</Button>
							<Button variant="outline" size="lg" asChild>
								<a href={siteConfig.github} target="_blank" rel="noopener noreferrer">
									<Github className="w-4 h-4 mr-2" />
									View on GitHub
								</a>
							</Button>
						</m.div>
					</m.div>
				</Container>
			</Section>

			{/* Pricing Preview - Clean Cards */}
			<Section className="py-16 bg-muted/30">
				<Container>
					<m.div
						className="text-center mb-12"
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
					>
						<m.p variants={fadeInUp} className="text-sm text-muted-foreground">
							Simple Pricing
						</m.p>
						<m.h2
							variants={fadeInUp}
							className="mt-4 text-3xl md:text-4xl font-semibold tracking-tight"
						>
							Open source core. Pay for automation.
						</m.h2>
						<m.p
							variants={fadeInUp}
							className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto"
						>
							The MCP + CLI stay free forever. Paid plans add GitHub integration and team features.
						</m.p>
					</m.div>

					<m.div
						className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto"
						variants={staggerContainer}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
					>
						{/* Free */}
						<m.div variants={fadeInUp} className="p-6 rounded-sm border border-border/50 bg-card">
							<div className="text-lg font-semibold text-foreground">Free</div>
							<div className="mt-2 text-3xl font-bold text-foreground">$0<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
							<p className="mt-2 text-sm text-muted-foreground">Perfect for personal repos</p>
							<ul className="mt-6 space-y-3 text-sm">
								<li className="flex items-center gap-2 text-muted-foreground">
									<Check className="w-4 h-4 text-primary" />
									1 active repo
								</li>
								<li className="flex items-center gap-2 text-muted-foreground">
									<Check className="w-4 h-4 text-primary" />
									20 PR analyses/month
								</li>
								<li className="flex items-center gap-2 text-muted-foreground">
									<Check className="w-4 h-4 text-primary" />
									MCP + CLI included
								</li>
							</ul>
							<Button variant="outline" className="w-full mt-6" asChild>
								<Link href="/pricing">Get started</Link>
							</Button>
						</m.div>

						{/* Solo */}
						<m.div variants={fadeInUp} className="p-6 rounded-sm border border-primary/30 bg-card shadow-lg relative">
							<div className="absolute -top-3 left-1/2 -translate-x-1/2">
								<span className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-sm">
									Popular
								</span>
							</div>
							<div className="text-lg font-semibold text-foreground">Solo</div>
							<div className="mt-2 text-3xl font-bold text-foreground">$9<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
							<p className="mt-2 text-sm text-muted-foreground">For indie builders</p>
							<ul className="mt-6 space-y-3 text-sm">
								<li className="flex items-center gap-2 text-muted-foreground">
									<Check className="w-4 h-4 text-primary" />
									3 active repos
								</li>
								<li className="flex items-center gap-2 text-muted-foreground">
									<Check className="w-4 h-4 text-primary" />
									100 PR analyses/month
								</li>
								<li className="flex items-center gap-2 text-muted-foreground">
									<Check className="w-4 h-4 text-primary" />
									GitHub App integration
								</li>
							</ul>
							<Button variant="cta" className="w-full mt-6" asChild>
								<Link href="/pricing">Upgrade</Link>
							</Button>
						</m.div>

						{/* Team */}
						<m.div variants={fadeInUp} className="p-6 rounded-sm border border-border/50 bg-card">
							<div className="text-lg font-semibold text-foreground">Team</div>
							<div className="mt-2 text-3xl font-bold text-foreground">$39<span className="text-sm font-normal text-muted-foreground">/seat/mo</span></div>
							<p className="mt-2 text-sm text-muted-foreground">For teams needing guardrails</p>
							<ul className="mt-6 space-y-3 text-sm">
								<li className="flex items-center gap-2 text-muted-foreground">
									<Check className="w-4 h-4 text-primary" />
									10 active repos
								</li>
								<li className="flex items-center gap-2 text-muted-foreground">
									<Check className="w-4 h-4 text-primary" />
									500 PR analyses/month
								</li>
								<li className="flex items-center gap-2 text-muted-foreground">
									<Check className="w-4 h-4 text-primary" />
									Org dashboards
								</li>
							</ul>
							<Button variant="outline" className="w-full mt-6" asChild>
								<Link href="/pricing">Talk to us</Link>
							</Button>
						</m.div>
					</m.div>

					<m.div
						className="text-center mt-6"
						initial={{ opacity: 0 }}
						whileInView={{ opacity: 1 }}
						viewport={{ once: true }}
					>
						<Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1">
							View full pricing details
							<ChevronRight className="w-3 h-3" />
						</Link>
					</m.div>
				</Container>
			</Section>

			{/* FAQ Section */}
			<Section className="py-20 bg-muted/30">
				<Container size="lg">
					<m.div
						className="max-w-3xl mx-auto"
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
					>
						<m.div variants={fadeInUp} className="text-center mb-12">
							<h2 className="text-3xl md:text-4xl font-bold tracking-tight">
								Frequently asked questions
							</h2>
							<p className="mt-4 text-lg text-muted-foreground">
								Everything you need to know about Memoria
							</p>
						</m.div>

						<m.div
							variants={fadeInUp}
							className="bg-card rounded-2xl border border-border/50 divide-y divide-border/50 px-6"
						>
							{faqs.map((faq, i) => (
								<FAQItem
									key={i}
									question={faq.question}
									answer={faq.answer}
									isOpen={openFAQ === i}
									onClick={() => setOpenFAQ(openFAQ === i ? null : i)}
								/>
							))}
						</m.div>

						<m.div variants={fadeInUp} className="text-center mt-8">
							<p className="text-muted-foreground">
								Still have questions?{" "}
								<a
									href={siteConfig.github + "/issues"}
									target="_blank"
									rel="noopener noreferrer"
									className="text-primary hover:underline"
								>
									Open an issue on GitHub
								</a>
							</p>
						</m.div>
					</m.div>
				</Container>
			</Section>

			{/* Final CTA - Compelling Design */}
			<Section className="py-24 relative overflow-hidden">
				{/* Background effects */}
				<div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-primary/10" />
				<div className="absolute inset-0 opacity-[0.02]" style={{
					backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
					backgroundSize: '32px 32px'
				}} />

				<Container size="md" className="relative">
					<m.div
						className="text-center"
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
					>
						{/* Icon */}
						<m.div
							variants={fadeInUp}
							className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-8"
						>
							<Shield className="w-8 h-8 text-primary" />
						</m.div>

						<m.h2
							variants={fadeInUp}
							className="text-4xl md:text-5xl font-bold tracking-tight"
						>
							Ready to give your AI{" "}
							<span className="relative">
								<span className="text-primary">memory</span>
								<m.span
									className="absolute -bottom-2 left-0 right-0 h-1 bg-primary/30 rounded-full"
									initial={{ scaleX: 0 }}
									whileInView={{ scaleX: 1 }}
									viewport={{ once: true }}
									transition={{ delay: 0.5, duration: 0.5 }}
								/>
							</span>
							?
						</m.h2>
						<m.p
							variants={fadeInUp}
							className="mt-6 text-xl text-muted-foreground max-w-xl mx-auto"
						>
							Install in seconds. Zero configuration. Watch your AI stop breaking things.
						</m.p>

						{/* CTA buttons */}
						<m.div
							variants={fadeInUp}
							className="mt-10 flex flex-col sm:flex-row gap-4 justify-center"
						>
							<Button variant="cta" size="lg" className="text-base h-12 px-8" asChild>
								<Link href="/pricing">
									Start free trial
									<ArrowRight className="w-4 h-4 ml-2" />
								</Link>
							</Button>
							<Button variant="outline" size="lg" className="text-base h-12 px-8" asChild>
								<a
									href={siteConfig.github}
									target="_blank"
									rel="noreferrer"
								>
									<Github className="w-4 h-4 mr-2" />
									Star on GitHub
								</a>
							</Button>
						</m.div>

						{/* Trust indicators */}
						<m.div
							variants={fadeInUp}
							className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground"
						>
							<div className="flex items-center gap-2">
								<Check className="w-4 h-4 text-primary" />
								<span>No credit card required</span>
							</div>
							<div className="flex items-center gap-2">
								<Check className="w-4 h-4 text-primary" />
								<span>Runs 100% locally</span>
							</div>
							<div className="flex items-center gap-2">
								<Check className="w-4 h-4 text-primary" />
								<span>Open source core</span>
							</div>
						</m.div>
					</m.div>
				</Container>
			</Section>
		</div>
	);
}
