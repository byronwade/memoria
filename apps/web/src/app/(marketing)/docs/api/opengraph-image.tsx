import { getOGMetadata } from "@/lib/og/metadata";
import { createOGImage } from "@/lib/og/template";

export const alt = "Memoria API Reference";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
	const metadata = getOGMetadata("/docs/api");
	return createOGImage({
		title: metadata.title,
		description: metadata.description,
		category: metadata.category,
	});
}
