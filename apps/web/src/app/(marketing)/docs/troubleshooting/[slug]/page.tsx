import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/docs/breadcrumb";
import { RelatedLinks } from "@/components/docs/related-links";
import { JsonLd } from "@/components/seo/JsonLd";
import {
	getAllTroubleshootingSlugs,
	getTroubleshootingBySlug,
	troubleshootingItems,
} from "@/data/troubleshooting";
import { generateFAQSchema } from "@/lib/seo/schema";

interface Props {
	params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
	return getAllTroubleshootingSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { slug } = await params;
	const item = getTroubleshootingBySlug(slug);

	if (!item) return { title: "Not Found" };

	return {
		title: `${item.shortTitle} | Memoria Troubleshooting`,
		description: item.description,
		keywords: item.keywords,
		openGraph: {
			title: item.title,
			description: item.description,
			type: "article",
		},
		alternates: {
			canonical: `/docs/troubleshooting/${slug}`,
		},
	};
}

export default async function TroubleshootingDetailPage({ params }: Props) {
	const { slug } = await params;
	const item = getTroubleshootingBySlug(slug);

	if (!item) notFound();

	const relatedItems = item.relatedIssues
		?.map((relatedSlug) =>
			troubleshootingItems.find((t) => t.slug === relatedSlug),
		)
		.filter(Boolean);

	const Icon = item.icon;

	// Generate FAQ schema from the content
	const faqs = [
		{
			question: item.content.problem,
			answer: item.content.solutions
				.map((s) => `${s.title}: ${s.description}`)
				.join(" "),
		},
	];

	return (
		<>
			<Breadcrumb
				items={[
					{ label: "Docs", href: "/docs" },
					{ label: "Troubleshooting", href: "/docs/troubleshooting" },
					{ label: item.shortTitle, href: `/docs/troubleshooting/${slug}` },
				]}
			/>
			<div className="docs-content">
				<JsonLd schema={generateFAQSchema(faqs)} />

				<div className="flex items-center gap-4 mb-4">
					<div className="p-3 rounded-lg bg-accent/10 text-accent">
						<Icon className="w-8 h-8" />
					</div>
					<h1 className="mb-0">{item.shortTitle}</h1>
				</div>

				<p className="lead">{item.description}</p>

				<h2>The Problem</h2>
				<p>{item.content.problem}</p>

				<h2>Common Causes</h2>
				<ul>
					{item.content.causes.map((cause, i) => (
						<li key={i}>{cause}</li>
					))}
				</ul>

				<h2>Solutions</h2>
				{item.content.solutions.map((solution, i) => (
					<div key={i} className="mb-6">
						<h3>{solution.title}</h3>
						<p>{solution.description}</p>
						{solution.code && (
							<pre className="code-block">
								<code>{solution.code}</code>
							</pre>
						)}
					</div>
				))}

				{relatedItems && relatedItems.length > 0 && (
					<RelatedLinks
						title="Related Issues"
						items={relatedItems.map((related) => ({
							title: related!.shortTitle,
							href: `/docs/troubleshooting/${related!.slug}`,
							description: related!.description,
						}))}
					/>
				)}
			</div>
		</>
	);
}
