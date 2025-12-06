import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/docs/breadcrumb";
import { RelatedLinks } from "@/components/docs/related-links";
import { JsonLd } from "@/components/seo/JsonLd";
import {
	featureItems,
	getAllFeatureSlugs,
	getFeatureBySlug,
} from "@/data/features";
import { siteConfig } from "@/lib/seo/constants";
import { generateTechArticleSchema } from "@/lib/seo/schema";

interface Props {
	params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
	return getAllFeatureSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { slug } = await params;
	const item = getFeatureBySlug(slug);

	if (!item) return { title: "Not Found" };

	return {
		title: `${item.shortTitle} | Memoria Features`,
		description: item.description,
		keywords: item.keywords,
		openGraph: {
			title: item.title,
			description: item.description,
			type: "article",
		},
		alternates: {
			canonical: `/docs/features/${slug}`,
		},
	};
}

export default async function FeaturePage({ params }: Props) {
	const { slug } = await params;
	const item = getFeatureBySlug(slug);

	if (!item) notFound();

	const relatedItems = item.relatedFeatures
		?.map((relatedSlug) => featureItems.find((f) => f.slug === relatedSlug))
		.filter(Boolean);

	const Icon = item.icon;

	return (
		<>
			<Breadcrumb
				items={[
					{ label: "Docs", href: "/docs" },
					{ label: "Features", href: "/docs/features" },
					{ label: item.shortTitle, href: `/docs/features/${slug}` },
				]}
			/>
			<div className="docs-content">
				<JsonLd
					schema={generateTechArticleSchema(
						item.title,
						item.description,
						`${siteConfig.url}/docs/features/${slug}`,
					)}
				/>

				<div className="flex items-center gap-4 mb-4">
					<div className="p-3 rounded-lg bg-accent/10 text-accent">
						<Icon className="w-8 h-8" />
					</div>
					<div>
						<h1 className="mb-0">{item.shortTitle}</h1>
						<p className="text-accent mt-1 mb-0">{item.tagline}</p>
					</div>
				</div>

				<p className="lead">{item.description}</p>

				<h2>Overview</h2>
				<p>{item.content.overview}</p>

				<h2>How It Works</h2>
				<ol>
					{item.content.howItWorks.map((step) => (
						<li key={step.step}>
							<strong>{step.title}</strong>: {step.description}
						</li>
					))}
				</ol>

				<h2>Technical Details</h2>
				<p>{item.content.technicalDetails}</p>

				<h2>Use Cases</h2>
				<div className="space-y-4">
					{item.content.useCases.map((useCase, i) => (
						<div key={i}>
							<h3>{useCase.title}</h3>
							<p>{useCase.description}</p>
						</div>
					))}
				</div>

				{item.content.configuration &&
					item.content.configuration.length > 0 && (
						<>
							<h2>Configuration Options</h2>
							<div className="overflow-x-auto">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b border-card-border">
											<th className="text-left py-3 px-4 font-semibold">
												Option
											</th>
											<th className="text-left py-3 px-4 font-semibold">
												Default
											</th>
											<th className="text-left py-3 px-4 font-semibold">
												Description
											</th>
										</tr>
									</thead>
									<tbody>
										{item.content.configuration.map((config, i) => (
											<tr key={i} className="border-b border-card-border">
												<td className="py-3 px-4">
													<code>{config.option}</code>
												</td>
												<td className="py-3 px-4">
													<code className="text-accent">{config.default}</code>
												</td>
												<td className="py-3 px-4 text-muted-foreground">
													{config.description}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</>
					)}

				{relatedItems && relatedItems.length > 0 && (
					<RelatedLinks
						title="Related Features"
						items={relatedItems.map((related) => ({
							title: related!.shortTitle,
							href: `/docs/features/${related!.slug}`,
							description: related!.tagline,
						}))}
					/>
				)}
			</div>
		</>
	);
}
