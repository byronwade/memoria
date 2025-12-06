"use client";

import Marquee from "react-fast-marquee";

// Placeholder AI tool logos using text/icons
const logos = [
	{ name: "Claude", icon: "C" },
	{ name: "Cursor", icon: "⌘" },
	{ name: "Windsurf", icon: "W" },
	{ name: "Continue", icon: "→" },
	{ name: "Cody", icon: "🤖" },
	{ name: "Copilot", icon: "✦" },
	{ name: "Aider", icon: "A" },
	{ name: "OpenHands", icon: "🤲" },
];

function LogoItem({ name, icon }: { name: string; icon: string }) {
	return (
		<div className="flex items-center gap-3 mx-8 opacity-50 hover:opacity-100 transition-opacity">
			<div className="w-10 h-10 rounded-lg bg-card border border-card-border flex items-center justify-center text-lg font-medium">
				{icon}
			</div>
			<span className="text-muted-foreground font-medium">{name}</span>
		</div>
	);
}

export function LogoMarquee() {
	return (
		<section className="py-12 border-y border-card-border">
			<p className="text-center text-sm text-muted-foreground mb-8">
				Works with MCP-compatible AI tools
			</p>
			<div className="relative">
				{/* Fade edges */}
				<div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
				<div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

				<Marquee speed={40} gradient={false} pauseOnHover>
					{logos.map((logo, index) => (
						<LogoItem key={index} name={logo.name} icon={logo.icon} />
					))}
				</Marquee>
			</div>
		</section>
	);
}
