import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/docs/breadcrumb";
import { featureItems } from "@/data/features";
import { generatePageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = generatePageMetadata({
	title: "Features",
	description:
		"Explore Memoria's thirteen analysis engines plus cloud memories and guardrails for teams. All local engines are 100% free.",
	path: "/docs/features",
	keywords: ["features", "engines", "code analysis", "git forensics", "cloud memories", "guardrails"],
});

export default function FeaturesPage() {
	return (
		<>
			<Breadcrumb
				items={[
					{ label: "Docs", href: "/docs" },
					{ label: "Features", href: "/docs/features" },
				]}
			/>
			<div className="docs-content">
				<h1>Features</h1>
				<p className="lead">
					Thirteen local analysis engines (free forever) plus cloud memories and guardrails for teams (paid).
				</p>

				<div className="p-4 rounded-lg border border-primary/30 bg-primary/5 mt-6 mb-8">
					<h3 className="text-lg font-semibold text-foreground mb-2">Free vs Paid</h3>
					<p className="text-muted-foreground text-sm mb-3">
						All 13 git analysis engines run <strong>100% free and locally</strong> — no account, no cloud, no limits.
					</p>
					<p className="text-muted-foreground text-sm">
						Paid plans add <strong>cloud memories</strong> (shared context across your team) and <strong>guardrails</strong> (file protection rules).
					</p>
				</div>

				<div className="grid gap-4 mt-8">
					{featureItems.map((item) => {
						const Icon = item.icon;
						return (
							<Link
								key={item.slug}
								href={`/docs/features/${item.slug}`}
								className="block p-6 rounded-lg border border-card-border bg-card hover:border-accent/50 transition-colors group"
							>
								<div className="flex items-start gap-4">
									<div className="p-2 rounded-lg bg-accent/10 text-accent">
										<Icon className="w-6 h-6" />
									</div>
									<div className="flex-1">
										<h3 className="font-semibold text-lg group-hover:text-accent transition-colors">
											{item.shortTitle}
										</h3>
										<p className="text-accent text-sm mt-1">{item.tagline}</p>
										<p className="text-muted-foreground text-sm mt-2">
											{item.description}
										</p>
									</div>
								</div>
							</Link>
						);
					})}
				</div>
			</div>
		</>
	);
}
