import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/docs/breadcrumb";
import { featureItems } from "@/data/features";
import { generatePageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = generatePageMetadata({
	title: "Features",
	description:
		"Explore Memoria's five powerful engines: Volatility, Entanglement, Sentinel, Static Import, and History Search for AI-powered code analysis.",
	path: "/docs/features",
	keywords: ["features", "engines", "code analysis", "git forensics"],
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
					Five powerful engines that analyze your git history to uncover hidden
					dependencies and prevent bugs.
				</p>

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
