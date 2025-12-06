"use client";

import { m } from "framer-motion";
import { ArrowRight, Check, Copy, Lock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const installCommand = "npx @byronwade/memoria";

function CopyInput({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);

	const copy = async () => {
		await navigator.clipboard.writeText(text);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div className="flex items-center gap-2 px-4 py-3 max-w-md mx-auto bg-muted rounded-xl border border-border">
			<Label htmlFor="install-command" className="sr-only">
				Install command
			</Label>
			<span className="text-muted-foreground font-mono" aria-hidden="true">
				$
			</span>
			<Input
				id="install-command"
				type="text"
				value={text}
				readOnly
				className="flex-1 bg-transparent font-mono text-sm border-0 shadow-none focus-visible:ring-0 p-0 h-auto"
			/>
			<Button
				variant="ghost"
				size="icon"
				onClick={copy}
				aria-label="Copy to clipboard"
				className="h-8 w-8"
			>
				{copied ? (
					<Check className="w-4 h-4 text-success" />
				) : (
					<Copy className="w-4 h-4 text-muted-foreground" />
				)}
			</Button>
		</div>
	);
}

export function Hero() {
	return (
		<section className="relative min-h-[90vh] flex items-center justify-center pt-24 pb-16 overflow-hidden">
			<Container size="md" className="relative z-10">
				<div className="text-center">
					{/* Small label - visitors.now style */}
					<m.p
						className="text-sm text-muted-foreground"
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.4 }}
					>
						An alternative to{" "}
						<span className="font-semibold text-foreground">
							breaking production
						</span>
					</m.p>

					{/* Headline - clean, bold, visitors.now style */}
					<m.h1
						className="mt-6 text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-foreground"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.5, delay: 0.1 }}
					>
						Fast, private, realtime
						<br />
						<span className="text-primary">code forensics</span>
					</m.h1>

					{/* Subtext */}
					<m.p
						className="mt-6 text-lg text-muted-foreground max-w-lg mx-auto"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.5, delay: 0.2 }}
					>
						Understand your codebase and how your AI engages with it.
						Prevent bugs before they happen.
					</m.p>

					{/* CTA Buttons - visitors.now style */}
					<m.div
						className="mt-10 flex items-center justify-center gap-4"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.5, delay: 0.3 }}
					>
						<Button variant="cta" size="lg" asChild>
							<Link href="/pricing">Start 14 day free trial</Link>
						</Button>
						<Button variant="outline" size="lg" asChild>
							<Link href="/docs">See demo</Link>
						</Button>
					</m.div>

					{/* Subtext under buttons */}
					<m.p
						className="mt-4 text-sm text-muted-foreground"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ duration: 0.5, delay: 0.4 }}
					>
						No credit card required
					</m.p>

					{/* Dashboard preview card */}
					<m.div
						className="mt-16 max-w-4xl mx-auto"
						initial={{ opacity: 0, y: 30 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6, delay: 0.5 }}
					>
						<Card className="overflow-hidden shadow-2xl p-0 border-border/50">
							{/* Dashboard header */}
							<div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
								<div className="flex items-center gap-3">
									<div className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center">
										<img
											src="/memoria.svg"
											alt=""
											className="w-4 h-4 invert dark:invert-0"
											aria-hidden="true"
										/>
									</div>
									<span className="font-medium text-foreground">Memoria</span>
								</div>
								<span className="text-sm text-muted-foreground">Today</span>
							</div>

							{/* Dashboard content */}
							<div className="p-6 bg-card">
								{/* Stats row */}
								<div className="grid grid-cols-4 gap-6 mb-6">
									<div>
										<p className="text-xs text-muted-foreground mb-1">Files Analyzed</p>
										<p className="text-2xl font-semibold text-foreground">1,193</p>
										<p className="text-xs text-success">+10%</p>
									</div>
									<div>
										<p className="text-xs text-muted-foreground mb-1">Dependencies</p>
										<p className="text-2xl font-semibold text-foreground">3,766</p>
										<p className="text-xs text-success">+12%</p>
									</div>
									<div>
										<p className="text-xs text-muted-foreground mb-1">Risk Score</p>
										<p className="text-2xl font-semibold text-foreground">34.8%</p>
										<p className="text-xs text-destructive">-8%</p>
									</div>
									<div>
										<p className="text-xs text-muted-foreground mb-1">Avg Analysis</p>
										<p className="text-2xl font-semibold text-foreground">3m 45s</p>
										<p className="text-xs text-success">+5%</p>
									</div>
								</div>

								{/* Chart placeholder */}
								<div className="h-40 bg-muted/30 rounded-xl flex items-end justify-center gap-1 p-4">
									{[40, 55, 45, 70, 60, 80, 75, 90, 85, 95, 88, 92].map((h, i) => (
										<div
											key={i}
											className="w-8 bg-primary/20 rounded-t"
											style={{ height: `${h}%` }}
										/>
									))}
								</div>
							</div>
						</Card>
					</m.div>

					{/* Badges */}
					<m.div
						className="mt-8 flex items-center justify-center gap-4 flex-wrap"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ duration: 0.5, delay: 0.6 }}
					>
						<a
							href="https://www.npmjs.com/package/@byronwade/memoria"
							target="_blank"
							rel="noopener noreferrer"
						>
							<img
								src="https://img.shields.io/npm/v/@byronwade/memoria.svg"
								alt="npm version"
								width={80}
								height={20}
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
								width={90}
								height={20}
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
								width={110}
								height={20}
								className="h-5"
							/>
						</a>
					</m.div>
				</div>
			</Container>
		</section>
	);
}
