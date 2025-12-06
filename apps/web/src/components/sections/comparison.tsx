"use client";

import { m } from "framer-motion";
import { Check, Minus } from "lucide-react";
import { Section } from "@/components/layout/section";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { fadeInUp, staggerContainer } from "@/lib/motion";

const comparisons = [
	{
		title: "Without Memoria",
		subtitle: "Manual context gathering",
		highlighted: false,
		features: [
			{ text: "AI edits one file at a time", included: true },
			{ text: "Manual file dependency tracking", included: false },
			{ text: "Breaks code it doesn't understand", included: false },
			{ text: "No historical context", included: false },
			{ text: "Misses implicit relationships", included: false },
		],
	},
	{
		title: "With Memoria",
		subtitle: "Git forensics powered",
		highlighted: true,
		features: [
			{ text: "AI understands file relationships", included: true },
			{ text: "Automatic entanglement detection", included: true },
			{ text: "Evidence-based file suggestions", included: true },
			{ text: "Git history analysis", included: true },
			{ text: "Prevents 'spooky action' bugs", included: true },
		],
	},
	{
		title: "Basic MCP",
		subtitle: "Standard file access",
		highlighted: false,
		features: [
			{ text: "Read and write files", included: true },
			{ text: "Basic file operations", included: true },
			{ text: "No relationship awareness", included: false },
			{ text: "No commit correlation", included: false },
			{ text: "No implicit dependencies", included: false },
		],
	},
];

function ComparisonCard({
	title,
	subtitle,
	highlighted,
	features,
}: {
	title: string;
	subtitle: string;
	highlighted: boolean;
	features: { text: string; included: boolean }[];
}) {
	return (
		<m.div variants={fadeInUp} className="relative">
			{highlighted && (
				<Badge className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 bg-primary text-primary-foreground">
					Recommended
				</Badge>
			)}
			<Card
				className={`h-full ${
					highlighted ? "border-2 border-primary shadow-lg" : ""
				}`}
			>
				<CardHeader className="text-center">
					<CardTitle className="text-foreground">{title}</CardTitle>
					<CardDescription>{subtitle}</CardDescription>
				</CardHeader>
				<CardContent>
					<ul className="space-y-3">
						{features.map((feature, index) => (
							<li key={index} className="flex items-start gap-3">
								{feature.included ? (
									<Check className="w-5 h-5 text-success shrink-0 mt-0.5" />
								) : (
									<Minus className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
								)}
								<span
									className={
										feature.included
											? "text-foreground"
											: "text-muted-foreground"
									}
								>
									{feature.text}
								</span>
							</li>
						))}
					</ul>
				</CardContent>
			</Card>
		</m.div>
	);
}

export function Comparison() {
	return (
		<Section>
			<m.div
				initial="hidden"
				whileInView="visible"
				viewport={{ once: true }}
				className="text-center mb-12"
			>
				<m.p
					variants={fadeInUp}
					className="text-sm text-muted-foreground"
				>
					Why Memoria?
				</m.p>
				<m.h2
					variants={fadeInUp}
					className="mt-4 text-3xl md:text-4xl font-semibold tracking-tight text-foreground"
				>
					The difference is context
				</m.h2>
				<m.p
					variants={fadeInUp}
					className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto"
				>
					AI assistants are powerful, but they lack memory of how your files
					relate. Memoria provides that missing context.
				</m.p>
			</m.div>

			<m.div
				className="grid md:grid-cols-3 gap-6"
				variants={staggerContainer}
				initial="hidden"
				whileInView="visible"
				viewport={{ once: true }}
			>
				{comparisons.map((comparison, index) => (
					<ComparisonCard key={index} {...comparison} />
				))}
			</m.div>
		</Section>
	);
}
