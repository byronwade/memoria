import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/docs/breadcrumb";
import { troubleshootingItems } from "@/data/troubleshooting";
import { generatePageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = generatePageMetadata({
	title: "Troubleshooting",
	description:
		"Find solutions to common Memoria issues including installation errors, configuration problems, and performance optimization tips.",
	path: "/docs/troubleshooting",
	keywords: ["troubleshooting", "errors", "issues", "help", "fix"],
});

export default function TroubleshootingPage() {
	return (
		<>
			<Breadcrumb
				items={[
					{ label: "Docs", href: "/docs" },
					{ label: "Troubleshooting", href: "/docs/troubleshooting" },
				]}
			/>
			<div className="docs-content">
				<h1>Troubleshooting</h1>
				<p className="lead">Common issues and how to resolve them.</p>

				<div className="grid gap-4 mt-8">
					{troubleshootingItems.map((item) => {
						const Icon = item.icon;
						return (
							<Link
								key={item.slug}
								href={`/docs/troubleshooting/${item.slug}`}
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
										<p className="text-muted-foreground text-sm mt-2">
											{item.description}
										</p>
									</div>
								</div>
							</Link>
						);
					})}
				</div>

				<div className="mt-12 p-6 rounded-lg border border-card-border bg-card">
					<h2 className="mt-0">Still Having Issues?</h2>
					<p>If you&apos;re still experiencing problems:</p>
					<ol>
						<li>
							Check{" "}
							<a
								href="https://github.com/byronwade/memoria/issues"
								target="_blank"
								rel="noopener noreferrer"
							>
								GitHub Issues
							</a>{" "}
							for known problems
						</li>
						<li>
							Open a new issue with:
							<ul>
								<li>Your OS and version</li>
								<li>
									Node.js version (<code>node --version</code>)
								</li>
								<li>AI tool and version (Cursor, Claude Code, etc.)</li>
								<li>Error message and steps to reproduce</li>
							</ul>
						</li>
					</ol>
				</div>
			</div>
		</>
	);
}
