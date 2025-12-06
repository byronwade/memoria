import { ArrowUpRight, HelpCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/layout/section";
import { siteConfig } from "@/lib/seo/constants";

const faqs = [
	{
		q: "Is Memoria really free?",
		a: "Yes! All 13 git analysis engines run 100% free and locally on your machine. No account, no API keys, no limits, no cloud connection required. We'll never paywall the core analysis.",
	},
	{
		q: "What do paid plans add?",
		a: "Paid plans add cloud memories (shared context across your team that persists between sessions), guardrails (file protection rules), and a team dashboard. The free tier is fully functional for solo developers.",
	},
	{
		q: "Do I need a paid plan to use Memoria with Claude/Cursor?",
		a: "No. Install the MCP server and use all 13 analysis engines completely free. Paid plans are optional for teams who want shared context across sessions and team members.",
	},
	{
		q: "What exactly does Memoria do?",
		a: "Memoria analyzes git history and diffs to find risky changes, missing co-change files, stale dependencies, and suggests tests. It posts a Risk & Impact Report to GitHub PRs or returns JSON via MCP/CLI.",
	},
	{
		q: "Is Memoria open source?",
		a: "Yes—the core engine, MCP server, and CLI are open source. The paid GitHub App and hosted API add automation, storage, and team controls.",
	},
	{
		q: "Do you store my code?",
		a: "No source code is ever stored. The free tier runs 100% locally. For paid cloud features, we only store memory text and guardrail patterns—never your actual codebase.",
	},
	{
		q: "Can I run Memoria locally?",
		a: "Absolutely. Run the MCP server inside Cursor/Windsurf/Claude or use the CLI. The same 13 engines run locally with no cloud dependency. This is the free tier and it works offline.",
	},
	{
		q: "How do I integrate with GitHub?",
		a: "Install the Memoria GitHub App. It listens to PR events, runs the analysis, and posts a comment. You can limit which repos are enabled from the dashboard.",
	},
	{
		q: "How are plans enforced?",
		a: "We count active repos and PR analyses per billing period. If you exceed limits, new analyses pause until you upgrade or the period resets.",
	},
	{
		q: "What’s on the roadmap?",
		a: "Slack/Teams alerts, GitLab/Bitbucket support, configurable check-run outputs, and deeper diff classification for UI vs backend changes.",
	},
];

export const metadata: Metadata = {
	title: "FAQ",
	description:
		"Answers about Memoria: open source core, GitHub App, pricing, privacy, and how to run the MCP/CLI locally.",
};

export default function FAQPage() {
	return (
		<div className="min-h-screen bg-background text-foreground">
			<Section className="pt-24 md:pt-28 pb-10">
				<Container className="space-y-6 max-w-3xl">
					<div className="flex justify-start">
						<span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
							FAQ
						</span>
					</div>
					<h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
						Everything you need to know.
					</h1>
					<p className="text-lg text-muted-foreground">
						Memoria exists to stop hidden regressions. Here are the details on
						how it works, what’s included, and how we keep your code safe.
					</p>
					<div className="flex flex-wrap items-center gap-3">
						<Button asChild size="lg" variant="cta">
							<a href={siteConfig.github} target="_blank" rel="noreferrer">
								View on GitHub <ArrowUpRight className="size-4" />
							</a>
						</Button>
						<Button asChild size="lg" variant="outline">
							<Link href="/pricing">See pricing</Link>
						</Button>
					</div>
				</Container>
			</Section>

			<Section className="py-16 md:py-20">
				<Container className="space-y-4 max-w-5xl">
					{faqs.map((item) => (
						<Card
							key={item.q}
							className="border border-card-border/70 bg-card/70 shadow-none"
						>
							<CardHeader className="flex flex-col gap-2">
								<div className="flex items-center gap-2 text-primary">
									<HelpCircle className="size-4" />
									<span className="text-xs uppercase tracking-[0.08em]">
										Question
									</span>
								</div>
								<CardTitle className="text-lg text-foreground">
									{item.q}
								</CardTitle>
							</CardHeader>
							<CardContent>
								<CardDescription className="text-muted-foreground">
									{item.a}
								</CardDescription>
							</CardContent>
						</Card>
					))}
				</Container>
			</Section>

			<Section className="py-16 md:py-20 border-t border-card-border/60">
				<Card className="mx-auto max-w-4xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card/80 text-center shadow-[0_25px_120px_-60px_var(--glow-color)]">
					<CardHeader className="space-y-4">
						<div className="flex justify-center">
							<span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
								Still curious?
							</span>
						</div>
						<CardTitle className="text-3xl md:text-4xl text-foreground">
							Let’s make your AI stop breaking code.
						</CardTitle>
						<CardDescription className="max-w-2xl mx-auto text-muted-foreground text-base">
							Install the GitHub App, wire the MCP server into your editor, or
							run the CLI locally. Memoria meets you where you ship code.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-wrap items-center justify-center gap-3">
						<Button asChild size="lg" variant="cta">
							<a href={siteConfig.github} target="_blank" rel="noreferrer">
								View on GitHub <ArrowUpRight className="size-4" />
							</a>
						</Button>
						<Button asChild size="lg" variant="outline">
							<Link href="/tour">Take the tour</Link>
						</Button>
						<Button asChild size="lg" variant="subtle">
							<Link href="/docs">Read the docs</Link>
						</Button>
					</CardContent>
				</Card>
			</Section>
		</div>
	);
}

