import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/seo/constants";

// Troubleshooting slugs for dynamic routes
const troubleshootingSlugs = [
	"command-not-found",
	"nodejs-version",
	"path-configuration",
	"mcp-connection",
	"git-not-available",
	"permission-errors",
	"config-file-errors",
	"performance-issues",
];

// Feature slugs for dynamic routes
const featureSlugs = [
	"volatility-engine",
	"entanglement-engine",
	"sentinel-engine",
	"static-import-engine",
	"history-search",
];

export default function sitemap(): MetadataRoute.Sitemap {
	const baseUrl = siteConfig.url;

	// Static pages
	const staticPages: MetadataRoute.Sitemap = [
		{
			url: baseUrl,
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 1.0,
		},
		{
			url: `${baseUrl}/pricing`,
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 0.9,
		},
		{
			url: `${baseUrl}/tour`,
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 0.9,
		},
		{
			url: `${baseUrl}/faq`,
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 0.9,
		},
		{
			url: `${baseUrl}/docs`,
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 0.9,
		},
	];

	// Installation pages - high priority
	const installationPages: MetadataRoute.Sitemap = [
		"installation",
		"installation/claude",
		"installation/cursor",
		"installation/windsurf",
		"installation/continue",
	].map((path) => ({
		url: `${baseUrl}/docs/${path}`,
		lastModified: new Date(),
		changeFrequency: "monthly" as const,
		priority: 0.8,
	}));

	// Documentation pages
	const docPages: MetadataRoute.Sitemap = [
		"how-it-works",
		"configuration",
		"auto-pilot",
		"cli",
		"api",
		"troubleshooting",
		"features",
		"changelog",
		"security",
		"contributing",
	].map((path) => ({
		url: `${baseUrl}/docs/${path}`,
		lastModified: new Date(),
		changeFrequency: "monthly" as const,
		priority: 0.7,
	}));

	// Dynamic troubleshooting pages
	const troubleshootingPages: MetadataRoute.Sitemap = troubleshootingSlugs.map(
		(slug) => ({
			url: `${baseUrl}/docs/troubleshooting/${slug}`,
			lastModified: new Date(),
			changeFrequency: "monthly" as const,
			priority: 0.6,
		}),
	);

	// Dynamic feature pages
	const featurePages: MetadataRoute.Sitemap = featureSlugs.map((slug) => ({
		url: `${baseUrl}/docs/features/${slug}`,
		lastModified: new Date(),
		changeFrequency: "monthly" as const,
		priority: 0.6,
	}));

	return [
		...staticPages,
		...installationPages,
		...docPages,
		...troubleshootingPages,
		...featurePages,
	];
}
