"use client";

import { m } from "framer-motion";
import { Flame, GitBranch, Heart, Link2, Search, Shield, Zap } from "lucide-react";
import Link from "next/link";
import { Section } from "@/components/layout/section";
import { fadeInUp, staggerContainer } from "@/lib/motion";

const features = [
	{
		slug: "volatility-engine",
		title: "GDPR compliant",
		description:
			"We pseudonymize data by default, ensuring total privacy and compliance with GDPR.",
		icon: Shield,
	},
	{
		slug: "entanglement-engine",
		title: "No cookie banners",
		description:
			"Our default settings are cookie-free, so you never need annoying consent banners for users.",
		icon: Heart,
	},
	{
		slug: "sentinel-engine",
		title: "Actually realtime",
		description:
			"Watch visitors and events stream to your dashboard the millisecond they happen.",
		icon: Zap,
	},
];

const engineFeatures = [
	{
		slug: "volatility-engine",
		title: "Volatility Engine",
		description:
			"Scans commits for panic keywords (fix, bug, revert, urgent, hotfix) with time-decay. Recent bugs matter more.",
		icon: Flame,
	},
	{
		slug: "entanglement-engine",
		title: "Entanglement Engine",
		description:
			"Finds files that change together >15% of the time. Reveals implicit dependencies that imports can't show.",
		icon: Link2,
	},
	{
		slug: "sentinel-engine",
		title: "Sentinel Engine",
		description:
			"Detects when coupled files are >7 days out of sync. Flags stale dependencies before they cause bugs.",
		icon: Shield,
	},
	{
		slug: "static-import-engine",
		title: "Static Import Engine",
		description:
			"Uses git grep to find files that import the target - even for brand new files with no git history.",
		icon: GitBranch,
	},
	{
		slug: "history-search",
		title: "History Search",
		description:
			"Search git history to understand WHY code was written. Solves the Chesterton's Fence problem.",
		icon: Search,
	},
];

export function Features() {
	return (
		<>
			{/* Top features - visitors.now style with icons in circles */}
			<Section id="features" className="bg-background">
				<m.div
					className="grid md:grid-cols-3 gap-12 text-center"
					variants={staggerContainer}
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true }}
				>
					{features.map((feature) => (
						<m.div key={feature.slug} variants={fadeInUp}>
							<div className="w-12 h-12 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
								<feature.icon className="w-5 h-5 text-muted-foreground" />
							</div>
							<h3 className="text-lg font-semibold text-foreground">
								{feature.title}
							</h3>
							<p className="mt-2 text-muted-foreground text-sm max-w-xs mx-auto">
								{feature.description}
							</p>
						</m.div>
					))}
				</m.div>
			</Section>

			{/* Engine features - card grid */}
			<Section className="bg-muted/30">
				<m.div
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true }}
					className="text-center mb-16"
				>
					<m.p
						variants={fadeInUp}
						className="text-sm text-muted-foreground"
					>
						Under the Hood
					</m.p>
					<m.h2
						variants={fadeInUp}
						className="mt-4 text-3xl md:text-4xl font-semibold tracking-tight text-foreground"
					>
						Five powerful engines
					</m.h2>
					<m.p
						variants={fadeInUp}
						className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto"
					>
						Memoria analyzes your git history to uncover hidden dependencies and
						prevent bugs
					</m.p>
				</m.div>

				<m.div
					className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
					variants={staggerContainer}
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true }}
				>
					{engineFeatures.map((feature) => (
						<Link
							key={feature.slug}
							href={`/docs/features/${feature.slug}`}
							className="block group"
						>
							<m.div
								variants={fadeInUp}
								className="h-full p-6 bg-card rounded-2xl border border-border transition-all duration-200 hover:border-primary/30 hover:shadow-lg"
							>
								<div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
									<feature.icon className="w-5 h-5 text-primary" />
								</div>
								<h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
									{feature.title}
								</h3>
								<p className="mt-2 text-muted-foreground text-sm">
									{feature.description}
								</p>
							</m.div>
						</Link>
					))}
				</m.div>
			</Section>
		</>
	);
}
