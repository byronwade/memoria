import { ArrowUpRight, Check, GitBranch, Shield, Workflow } from "lucide-react";
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

const flows = [
	{
		label: "MCP + CLI",
		badge: "100% FREE",
		badgeColor: "green",
		title: "Local analysis",
		copy: "Run the MCP server in Cursor/Windsurf/Claude or use the CLI. All 13 engines run locally with no account or cloud connection.",
		points: [
			"All 13 git analysis engines included",
			"Works entirely offline — no account needed",
			"Same engines as paid plans",
			"Unlimited local analysis forever",
		],
	},
	{
		label: "GitHub App",
		badge: "PAID",
		badgeColor: "primary",
		title: "PR automation",
		copy: "Memoria inspects the PR diff, calculates risk, finds missing co-change files, and posts a Risk & Impact Report as a comment.",
		points: [
			"Automatic PR comments on every push",
			"Risk level with coupling scores",
			"Missing co-changed files flagged",
			"Team-wide visibility",
		],
	},
	{
		label: "Dashboard + Memories",
		badge: "PAID",
		badgeColor: "primary",
		title: "Team intelligence",
		copy: "Cloud memories persist lessons learned across sessions. Guardrails protect critical files. Dashboards show trends.",
		points: [
			"Cloud memories shared across team",
			"Guardrails to protect sensitive files",
			"Risk history and file heatmaps",
			"Org-wide analytics",
		],
	},
];

const engines = [
	{
		title: "Entanglement",
		copy: "Finds files that historically change together so you never miss a hidden dependency.",
		icon: Workflow,
	},
	{
		title: "Sentinel",
		copy: "Flags stale coupled files and drift so API or config mismatches don’t slip through.",
		icon: Shield,
	},
	{
		title: "Volatility + History",
		copy: "Weights recent bug fixes higher and surfaces commits that explain why code exists.",
		icon: GitBranch,
	},
];

export const metadata: Metadata = {
	title: "Product Tour",
	description:
		"See how Memoria delivers Risk & Impact reports via GitHub App, MCP, and CLI with the same analysis engine.",
};

export default function TourPage() {
	return (
		<div className="min-h-screen bg-background text-foreground">
			<Section className="pt-24 md:pt-28 pb-10">
				<Container className="space-y-6 max-w-4xl">
					<div className="flex justify-start">
						<span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary shadow-[0_8px_30px_-20px_var(--glow-color)]">
							Product tour
						</span>
					</div>
					<h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
						Risk & Impact, everywhere you ship code.
					</h1>
					<p className="text-lg text-muted-foreground">
						Memoria&apos;s core analysis is <strong>100% free</strong> via MCP/CLI. Paid plans add
						automation, cloud memories, and team features.
					</p>
					<div className="flex flex-wrap items-center gap-3">
						<Button asChild size="lg" variant="cta">
							<Link href="/pricing">
								Start free trial <ArrowUpRight className="size-4" />
							</Link>
						</Button>
						<Button asChild size="lg" variant="outline">
							<Link href="/pricing">See pricing</Link>
						</Button>
						<Link
							href={siteConfig.github}
							className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-2"
						>
							View on GitHub <ArrowUpRight className="size-4" />
						</Link>
					</div>
				</Container>
			</Section>

			<Section className="py-16 md:py-20">
				<Container className="grid gap-6 md:grid-cols-3">
					{flows.map((flow) => (
						<Card
							key={flow.title}
							className={`border-card-border/70 bg-card shadow-sm ${flow.badgeColor === "green" ? "border-green-500/30" : ""}`}
						>
							<CardHeader className="space-y-2">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2 text-xs uppercase tracking-[0.08em] text-primary">
										<ArrowUpRight className="size-4" />
										{flow.label}
									</div>
									<span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded ${
										flow.badgeColor === "green"
											? "bg-green-500/20 text-green-600 dark:text-green-400"
											: "bg-primary/20 text-primary"
									}`}>
										{flow.badge}
									</span>
								</div>
								<CardTitle className="text-xl text-foreground">
									{flow.title}
								</CardTitle>
								<CardDescription className="text-muted-foreground">
									{flow.copy}
								</CardDescription>
							</CardHeader>
							<CardContent>
								<ul className="space-y-2 text-sm text-muted-foreground">
									{flow.points.map((point) => (
										<li key={point} className="flex items-start gap-2">
											<Check className="mt-0.5 size-4 text-primary" />
											<span>{point}</span>
										</li>
									))}
								</ul>
							</CardContent>
						</Card>
					))}
				</Container>
			</Section>

			<Section className="py-16 md:py-20 border-t border-card-border/60">
				<Container className="grid gap-8 lg:grid-cols-[1.1fr_1fr] items-start">
					<div className="space-y-3">
						<span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary shadow-[0_8px_30px_-20px_var(--glow-color)]">
							The engines
						</span>
						<h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
							Senior developer intuition, automated.
						</h2>
						<p className="text-muted-foreground">
							Memoria fuses entanglement, drift detection, volatility scoring,
							and history search into one analysis so you know what to check
							before merging.
						</p>
					</div>
					<div className="grid gap-4 sm:grid-cols-2">
						{engines.map((engine) => (
							<Card
								key={engine.title}
								className="border border-card-border/70 bg-card shadow-sm"
							>
								<CardHeader className="space-y-2">
									<div className="flex items-center gap-2 text-primary">
										<engine.icon className="size-4" />
										<span className="text-xs uppercase tracking-[0.08em]">
											{engine.title}
										</span>
									</div>
									<CardTitle className="text-lg text-foreground">
										{engine.title}
									</CardTitle>
									<CardDescription className="text-sm text-muted-foreground leading-6">
										{engine.copy}
									</CardDescription>
								</CardHeader>
							</Card>
						))}
					</div>
				</Container>
			</Section>

			<Section className="py-16 md:py-20 border-t border-card-border/60">
				<Card className="mx-auto max-w-5xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card/85 text-center shadow-[0_30px_120px_-70px_var(--glow-color)]">
					<CardHeader className="space-y-4">
						<div className="flex justify-center">
							<span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary shadow-[0_8px_30px_-20px_var(--glow-color)]">
								Start now
							</span>
						</div>
						<CardTitle className="text-3xl md:text-4xl text-foreground">
							Wire Memoria into your workflow in minutes.
						</CardTitle>
						<CardDescription className="max-w-2xl mx-auto text-muted-foreground text-base">
							Install the GitHub App for automated PR comments, or add the MCP
							server to your editor and run it locally. The output is identical.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-wrap items-center justify-center gap-3">
						<Button asChild size="lg" variant="cta">
							<Link href="/pricing">
								Start free trial <ArrowUpRight className="size-4" />
							</Link>
						</Button>
						<Button asChild size="lg" variant="outline">
							<Link href="/pricing">Compare plans</Link>
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
