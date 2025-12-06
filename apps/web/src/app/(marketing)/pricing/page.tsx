import { ArrowUpRight, Check, Sparkles } from "lucide-react";
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

const tiers = [
	{
		name: "Free",
		price: "$0",
		tagline: "Perfect for personal repos or local MCP use.",
		features: [
			"1 active repo",
			"Up to 20 PR analyses / month",
			"MCP + CLI included",
			"Risk & Impact PR comments",
		],
		cta: "Start on GitHub",
		link: siteConfig.github,
		popular: false,
	},
	{
		name: "Solo",
		price: "$9",
		tagline: "For indie builders shipping with guardrails.",
		features: [
			"3 active repos",
			"Up to 100 PR analyses / month",
			"MCP + CLI + GitHub App",
			"Priority fixes & support",
		],
		cta: "Upgrade",
		link: siteConfig.github,
		popular: true,
	},
	{
		name: "Team",
		price: "$39",
		tagline: "For teams needing automated risk checks.",
		features: [
			"10 active repos",
			"Up to 500 PR analyses / month",
			"Org dashboards & usage limits",
			"Slack-ready summaries (soon)",
		],
		cta: "Talk to us",
		link: "mailto:byron@byronwade.com?subject=Memoria%20Team",
		popular: false,
	},
];

const faqs = [
	{
		q: "Is the core engine open source?",
		a: "Yes. The MCP server, CLI, and analysis engine are all OSS. The GitHub App and hosted automation are the paid layer.",
	},
	{
		q: "Can I self-host?",
		a: "Absolutely. You can run the CLI or MCP locally, or deploy the engine yourself. The paid plans are for convenience, GitHub integration, and managed infra.",
	},
	{
		q: "What happens if I exceed my plan limits?",
		a: "We pause new analyses for the billing period and prompt you to upgrade. Your data stays safe; nothing is deleted.",
	},
	{
		q: "Do you store my code?",
		a: "Diffs are processed in-memory for analysis and discarded. We keep metadata (repo, PR number, risk level) for dashboard history.",
	},
];

export const metadata: Metadata = {
	title: "Pricing",
	description:
		"Simple pricing for Memoria: open-source MCP locally, paid GitHub App and hosted automation when you need it.",
};

export default function PricingPage() {
	return (
		<div className="min-h-screen bg-background text-foreground">
			<Section className="pt-24 md:pt-28 pb-10">
				<Container className="space-y-6 text-center max-w-4xl">
					<div className="flex justify-center">
						<span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary shadow-[0_8px_30px_-20px_var(--glow-color)]">
							Pricing
						</span>
					</div>
					<h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
						Keep the engine free. Pay for automation.
					</h1>
					<p className="text-lg text-muted-foreground">
						Memoria MCP + CLI stay open-source. The GitHub App, hosted API, and
						dashboard live on paid plans so your team never ships blind.
					</p>
					<div className="flex flex-wrap items-center justify-center gap-3">
						<Button asChild size="lg" variant="cta">
							<a href={siteConfig.github} target="_blank" rel="noreferrer">
								View on GitHub <ArrowUpRight className="size-4" />
							</a>
						</Button>
						<Button asChild size="lg" variant="outline">
							<Link href="/tour">See the product tour</Link>
						</Button>
					</div>
				</Container>
			</Section>

			<Section className="py-14 md:py-18">
				<Container className="grid gap-6 md:grid-cols-3">
					{tiers.map((tier) => (
						<Card
							key={tier.name}
							className={`h-full ${
								tier.popular
									? "border-primary/30 bg-primary/6 shadow-[0_24px_110px_-60px_var(--glow-color)]"
									: "border-card-border/70"
							}`}
						>
							<CardHeader className="space-y-2">
								<div className="flex items-center justify-between">
									<CardTitle className="text-xl">{tier.name}</CardTitle>
									{tier.popular && (
										<span className="rounded-full border border-primary/40 bg-primary text-primary-foreground px-3 py-1 text-xs font-medium">
											Popular
										</span>
									)}
								</div>
								<div className="text-3xl font-semibold text-foreground">
									{tier.price}
									<span className="text-sm text-muted-foreground font-normal">
										{tier.name === "Team" ? "/seat/mo" : "/mo"}
									</span>
								</div>
								<CardDescription className="text-muted-foreground">
									{tier.tagline}
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<ul className="space-y-2 text-sm text-muted-foreground">
									{tier.features.map((feature) => (
										<li key={feature} className="flex items-start gap-2">
											<Check className="mt-0.5 size-4 text-primary" />
											<span>{feature}</span>
										</li>
									))}
								</ul>
								<Button
									asChild
									variant={tier.popular ? "cta" : "outline"}
									className="w-full"
								>
									<a
										href={tier.link}
										target={tier.link.startsWith("mailto") ? "_self" : "_blank"}
										rel="noreferrer"
									>
										{tier.cta}
									</a>
								</Button>
							</CardContent>
						</Card>
					))}
				</Container>
			</Section>

			<Section className="py-16 md:py-20 border-t border-card-border/60">
				<Container className="grid gap-8 lg:grid-cols-[1.1fr_1fr] items-start">
					<div className="space-y-3">
						<span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary shadow-[0_8px_30px_-20px_var(--glow-color)]">
							Included in every plan
						</span>
						<h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
							Same engine everywhere.
						</h2>
						<p className="text-muted-foreground">
							You get the full Memoria engines whether you run it locally via
							MCP/CLI or through the hosted GitHub App. The difference is the
							automation, storage, and team controls.
						</p>
					</div>
					<Card className="border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card/85 shadow-[0_20px_90px_-60px_var(--glow-color)]">
						<CardHeader className="space-y-2">
							<div className="flex items-center gap-2 text-xs uppercase tracking-[0.08em] text-primary">
								<Sparkles className="size-4" />
								What you always get
							</div>
							<CardTitle className="text-xl text-foreground">
								Risk & Impact analysis on every diff
							</CardTitle>
							<CardDescription className="text-sm text-muted-foreground">
								Volatility, entanglement, static imports, and Sentinel drift
								checks combined into one actionable report.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<ul className="space-y-2 text-sm text-muted-foreground">
								<li className="flex items-start gap-2">
									<Check className="mt-0.5 size-4 text-primary" />
									<span>Risk level with missing co-change files</span>
								</li>
								<li className="flex items-start gap-2">
									<Check className="mt-0.5 size-4 text-primary" />
									<span>Suggested tests and pre-flight checklist</span>
								</li>
								<li className="flex items-start gap-2">
									<Check className="mt-0.5 size-4 text-primary" />
									<span>PR comments via GitHub App or local MCP output</span>
								</li>
								<li className="flex items-start gap-2">
									<Check className="mt-0.5 size-4 text-primary" />
									<span>Open-source core you can self-host anytime</span>
								</li>
							</ul>
						</CardContent>
					</Card>
				</Container>
			</Section>

			<Section className="py-16 md:py-20 border-t border-card-border/60">
				<Container className="max-w-5xl space-y-10">
					<div className="text-center space-y-2">
						<h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
							Questions, answered.
						</h2>
						<p className="text-muted-foreground">
							If you want something custom, reach out. We&apos;re shipping fast.
						</p>
					</div>
					<div className="space-y-4">
						{faqs.map((item) => (
							<Card key={item.q} className="border-card-border/70 bg-card shadow-sm">
								<CardHeader>
									<CardTitle className="text-lg text-foreground">
										{item.q}
									</CardTitle>
									<CardDescription className="text-muted-foreground">
										{item.a}
									</CardDescription>
								</CardHeader>
							</Card>
						))}
					</div>
					<div className="flex flex-wrap items-center justify-center gap-3">
						<Button asChild variant="cta" size="lg">
							<a href={siteConfig.github} target="_blank" rel="noreferrer">
								View on GitHub <ArrowUpRight className="size-4" />
							</a>
						</Button>
						<Button asChild variant="outline" size="lg">
							<Link href="/faq">Read the FAQ</Link>
						</Button>
					</div>
				</Container>
			</Section>
		</div>
	);
}
