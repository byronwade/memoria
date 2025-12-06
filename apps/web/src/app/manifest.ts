import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/seo/constants";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: `${siteConfig.name} - ${siteConfig.tagline}`,
		short_name: siteConfig.name,
		description: siteConfig.description,
		start_url: "/",
		display: "standalone",
	background_color: siteConfig.themeColor,
	theme_color: siteConfig.themeColor,
		icons: [
			{
				src: "/android-chrome-192x192.png",
				sizes: "192x192",
				type: "image/png",
			},
			{
				src: "/android-chrome-512x512.png",
				sizes: "512x512",
				type: "image/png",
			},
		],
	};
}
