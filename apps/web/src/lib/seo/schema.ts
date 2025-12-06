import { siteConfig } from "./constants";

export function generateWebSiteSchema() {
	return {
		"@context": "https://schema.org",
		"@type": "WebSite",
		name: siteConfig.name,
		description: siteConfig.description,
		url: siteConfig.url,
		author: {
			"@type": "Person",
			name: siteConfig.author.name,
		},
	};
}

export function generateSoftwareApplicationSchema() {
	return {
		"@context": "https://schema.org",
		"@type": "SoftwareApplication",
		name: siteConfig.name,
		description: siteConfig.description,
		applicationCategory: "DeveloperApplication",
		operatingSystem: "Cross-platform",
		offers: {
			"@type": "Offer",
			price: "0",
			priceCurrency: "USD",
		},
		author: {
			"@type": "Person",
			name: siteConfig.author.name,
			url: siteConfig.author.url,
		},
		downloadUrl: siteConfig.npm,
		softwareRequirements: "Node.js 18+, Git",
		releaseNotes: siteConfig.github,
		featureList: [
			"Volatility Engine - Scans commits for panic keywords",
			"Entanglement Engine - Finds files that change together",
			"Sentinel Engine - Detects stale dependencies",
			"Static Import Engine - Uses git grep for imports",
			"History Search - Search git history",
		],
	};
}

export function generateOrganizationSchema() {
	return {
		"@context": "https://schema.org",
		"@type": "Person",
		name: siteConfig.author.name,
		url: siteConfig.author.url,
		sameAs: [siteConfig.github],
	};
}

export function generateFAQSchema(
	faqs: { question: string; answer: string }[],
) {
	return {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		mainEntity: faqs.map((faq) => ({
			"@type": "Question",
			name: faq.question,
			acceptedAnswer: {
				"@type": "Answer",
				text: faq.answer,
			},
		})),
	};
}

export function generateHowToSchema(
	name: string,
	description: string,
	steps: { name: string; text: string }[],
) {
	return {
		"@context": "https://schema.org",
		"@type": "HowTo",
		name,
		description,
		totalTime: "PT5M",
		tool: [
			{ "@type": "HowToTool", name: "Node.js 18+" },
			{ "@type": "HowToTool", name: "npm/npx" },
		],
		step: steps.map((step, index) => ({
			"@type": "HowToStep",
			position: index + 1,
			name: step.name,
			text: step.text,
		})),
	};
}

export function generateBreadcrumbSchema(
	items: { name: string; url: string }[],
) {
	return {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: items.map((item, index) => ({
			"@type": "ListItem",
			position: index + 1,
			name: item.name,
			item: item.url,
		})),
	};
}

export function generateTechArticleSchema(
	title: string,
	description: string,
	url: string,
) {
	return {
		"@context": "https://schema.org",
		"@type": "TechArticle",
		headline: title,
		description,
		author: {
			"@type": "Person",
			name: siteConfig.author.name,
		},
		publisher: {
			"@type": "Organization",
			name: siteConfig.name,
		},
		mainEntityOfPage: {
			"@type": "WebPage",
			"@id": url,
		},
	};
}
