import type { Metadata } from "next";
import { siteConfig } from "./constants";

interface PageMetadataOptions {
	title: string;
	description: string;
	path: string;
	keywords?: string[];
	noIndex?: boolean;
}

export function generatePageMetadata({
	title,
	description,
	path,
	keywords = [],
	noIndex = false,
}: PageMetadataOptions): Metadata {
	const fullTitle = `${title} | ${siteConfig.name}`;
	const url = `${siteConfig.url}${path}`;

	return {
		title: fullTitle,
		description,
		keywords: [...siteConfig.keywords, ...keywords],
		authors: [{ name: siteConfig.author.name, url: siteConfig.author.url }],
		creator: siteConfig.author.name,
		publisher: siteConfig.author.name,

		alternates: {
			canonical: url,
		},

		openGraph: {
			title: fullTitle,
			description,
			url,
			siteName: siteConfig.name,
			locale: siteConfig.locale,
			type: "website",
		},

		twitter: {
			card: "summary_large_image",
			title: fullTitle,
			description,
			site: siteConfig.author.twitter,
			creator: siteConfig.author.twitter,
		},

		robots: noIndex
			? { index: false, follow: false }
			: { index: true, follow: true },
	};
}
