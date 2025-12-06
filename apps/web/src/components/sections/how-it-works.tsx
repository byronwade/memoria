"use client";

import { m } from "framer-motion";
import { Check, MessageSquare, Sparkles, Terminal } from "lucide-react";
import { Section } from "@/components/layout/section";
import { fadeInUp, staggerContainer } from "@/lib/motion";

const steps = [
	{
		number: "01",
		title: "Install Memoria",
		description: "One line in your MCP config. No setup, no configuration.",
		icon: Terminal,
	},
	{
		number: "02",
		title: "Ask Your AI",
		description:
			"Request analysis of any file. Memoria automatically provides context.",
		icon: MessageSquare,
	},
	{
		number: "03",
		title: "AI Gets Context",
		description:
			"Your AI receives dependency graphs, volatility scores, and evidence.",
		icon: Sparkles,
	},
	{
		number: "04",
		title: "Confident Changes",
		description: "Make changes knowing all related files are accounted for.",
		icon: Check,
	},
];

export function HowItWorks() {
	return (
		<Section id="how-it-works" className="bg-muted/30">
			<m.div
				initial="hidden"
				whileInView="visible"
				viewport={{ once: true }}
				className="text-center mb-16"
			>
				<m.h2
					variants={fadeInUp}
					className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground"
				>
					Get Started in Minutes
				</m.h2>
				<m.p
					variants={fadeInUp}
					className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto"
				>
					Four simple steps to give your AI memory
				</m.p>
			</m.div>

			<m.div
				className="grid md:grid-cols-2 lg:grid-cols-4 gap-8"
				variants={staggerContainer}
				initial="hidden"
				whileInView="visible"
				viewport={{ once: true }}
			>
				{steps.map((step, index) => (
					<m.div
						key={step.number}
						variants={fadeInUp}
						className="relative"
					>
						{/* Connector line - positioned to connect between icons */}
						{index < steps.length - 1 && (
							<div className="hidden lg:block absolute top-8 left-[calc(4rem+1rem)] right-0 h-px bg-gradient-to-r from-border to-transparent" />
						)}

						<div className="relative">
							<div className="w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center mb-4 relative z-10">
								<step.icon className="w-7 h-7 text-primary" />
							</div>
							<span className="text-xs font-mono text-muted-foreground">
								{step.number}
							</span>
							<h3 className="mt-1 text-lg font-semibold text-foreground">{step.title}</h3>
							<p className="mt-2 text-sm text-muted-foreground">
								{step.description}
							</p>
						</div>
					</m.div>
				))}
			</m.div>
		</Section>
	);
}
