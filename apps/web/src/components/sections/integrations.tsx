"use client";

import { m } from "framer-motion";
import Link from "next/link";
import { Section } from "@/components/layout/section";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { fadeInUp } from "@/lib/motion";

const integrations = [
	{
		name: "Claude Desktop",
		icon: "C",
		path: "/docs/installation/claude",
		color: "bg-orange-500",
	},
	{
		name: "Cursor",
		icon: "⌘",
		path: "/docs/installation/cursor",
		color: "bg-blue-500",
	},
	{
		name: "Windsurf",
		icon: "W",
		path: "/docs/installation/windsurf",
		color: "bg-emerald-500",
	},
	{
		name: "Continue",
		icon: "→",
		path: "/docs/installation/continue",
		color: "bg-purple-500",
	},
];

export function Integrations() {
	return (
		<Section>
			<m.div
				initial="hidden"
				whileInView="visible"
				viewport={{ once: true }}
				className="text-center"
			>
				<m.p
					variants={fadeInUp}
					className="text-sm text-muted-foreground uppercase tracking-wider font-medium"
				>
					Integrations
				</m.p>
				<m.h2
					variants={fadeInUp}
					className="mt-4 text-3xl md:text-4xl font-medium tracking-tight"
				>
					Works with your tools
				</m.h2>
				<m.p
					variants={fadeInUp}
					className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto"
				>
					Memoria integrates seamlessly with MCP-compatible AI assistants
				</m.p>

				{/* Stacked avatar style logos */}
				<m.div
					variants={fadeInUp}
					className="mt-12 flex items-center justify-center"
				>
					<div className="flex -space-x-3">
						{integrations.map((integration, index) => (
							<Link
								key={integration.path}
								href={integration.path}
								className="relative group"
								style={{ zIndex: integrations.length - index }}
							>
								<Avatar
									className={`w-14 h-14 ring-4 ring-background transition-transform group-hover:-translate-y-2 group-hover:rotate-6 ${integration.color}`}
								>
									<AvatarFallback className="bg-transparent text-white text-lg font-semibold">
										{integration.icon}
									</AvatarFallback>
								</Avatar>
								<div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap text-sm text-muted-foreground">
									{integration.name}
								</div>
							</Link>
						))}
						<Link
							href="/docs/installation"
							className="relative group"
							style={{ zIndex: 0 }}
						>
							<Avatar className="w-14 h-14 bg-muted ring-4 ring-background transition-transform group-hover:-translate-y-2 group-hover:rotate-6">
								<AvatarFallback className="bg-transparent text-muted-foreground text-sm font-semibold">
									+N
								</AvatarFallback>
							</Avatar>
							<div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap text-sm text-muted-foreground">
								More tools
							</div>
						</Link>
					</div>
				</m.div>

				<m.div variants={fadeInUp} className="mt-16">
					<Link
						href="/docs/installation"
						className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
					>
						View all installation guides →
					</Link>
				</m.div>
			</m.div>
		</Section>
	);
}
