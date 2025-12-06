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
		period: "forever",
		tagline: "All 13 engines. No account. No limits.",
		features: [
			"All 13 git analysis engines",
			"Unlimited local analysis",
			"MCP + CLI included",
			"Works offline",
		],
		cta: "Install Free",
		link: "/docs/installation",
		popular: false,
	},
	{
		name: "Pro",
		price: "$5",
		period: "/month",
		tagline: "Cloud memories that persist across sessions.",
		features: [
			"Everything in Free",
			"Unlimited cloud memories",
			"Personal guardrails (10 rules)",
			"Dashboard & analytics",
			"Email support",
		],
		cta: "Start Free Trial",
		link: "/register",
		popular: true,
	},
	{
		name: "Team",
		price: "$8",
		period: "/seat/month",
		tagline: "Shared memories across your whole team.",
		features: [
			"Everything in Pro",
			"Team-wide shared memories",
			"Unlimited guardrails",
			"Org-level analytics",
			"Priority support",
			"SSO & audit logs (coming)",
		],
		cta: "Start Team Trial",
		link: "/register?plan=team",
		popular: false,
	},
];

const faqs = [
	{
		q: "Why is Pro only $5/month?",
		a: "We want every developer to afford cloud memories. $5 is less than a coffee. If Memoria saves you from one regression, it's paid for itself for years.",
	},
	{
		q: "Can I use the free tier forever?",
		a: "Yes. All 13 git analysis engines run 100% free, locally, forever. No account, no limits. Pro just adds cloud sync so your memories persist across sessions.",
	},
	{
		q: "How does Team pricing work?",
		a: "$8/seat/month. A team of 5 is $40/month. Memories are shared across the whole team, so when one person learns something, everyone benefits.",
	},
	{
		q: "Is there a free trial?",
		a: "Yes! Pro and Team both have a 14-day free trial. No credit card required to start. Cancel anytime.",
	},
	{
		q: "What if I need more than 10 guardrails on Pro?",
		a: "Upgrade to Team for unlimited guardrails. Or reach out — we're flexible for solo developers with complex setups.",
	},
	{
		q: "Do you store my code?",
		a: "Never. We only store memory text and guardrail patterns. Your source code stays on your machine. The free tier doesn't even need an account.",
	},
];

export const metadata: Metadata = {
	title: "Pricing",
	description:
		"Memoria pricing: Free local git analysis forever. Paid plans add cloud memories, guardrails, and team dashboards.",
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
						Free locally. Pay for team intelligence.
					</h1>
					<p className="text-lg text-muted-foreground">
						All 13 git analysis engines run free forever. Paid plans add cloud
						memories, guardrails, and team dashboards.
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
										{tier.period}
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
							Free forever
						</span>
						<h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
							All 13 engines. Zero cost.
						</h2>
						<p className="text-muted-foreground">
							The full git analysis suite runs locally on your machine. No account,
							no cloud, no limits. Works offline. We&apos;ll never paywall the core engines.
						</p>
					</div>
					<Card className="border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card/85 shadow-[0_20px_90px_-60px_var(--glow-color)]">
						<CardHeader className="space-y-2">
							<div className="flex items-center gap-2 text-xs uppercase tracking-[0.08em] text-primary">
								<Sparkles className="size-4" />
								What you always get (free)
							</div>
							<CardTitle className="text-xl text-foreground">
								Complete git forensics analysis
							</CardTitle>
							<CardDescription className="text-sm text-muted-foreground">
								Volatility, entanglement, static imports, drift detection, history search,
								and 8 more engines running in parallel.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<ul className="space-y-2 text-sm text-muted-foreground">
								<li className="flex items-start gap-2">
									<Check className="mt-0.5 size-4 text-primary" />
									<span>Risk scores and coupled file detection</span>
								</li>
								<li className="flex items-start gap-2">
									<Check className="mt-0.5 size-4 text-primary" />
									<span>Pre-flight checklist before every edit</span>
								</li>
								<li className="flex items-start gap-2">
									<Check className="mt-0.5 size-4 text-primary" />
									<span>Git history search (Chesterton&apos;s Fence)</span>
								</li>
								<li className="flex items-start gap-2">
									<Check className="mt-0.5 size-4 text-primary" />
									<span>~150ms total analysis time</span>
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
