// Font loading for OG images
// Need to use TTF format since ImageResponse doesn't support woff2

let interFontCache: ArrayBuffer | null = null;

export async function loadGeistFont(): Promise<ArrayBuffer | null> {
	if (interFontCache) {
		return interFontCache;
	}

	try {
		// Fetch Inter font in TTF format
		const response = await fetch(
			"https://cdn.jsdelivr.net/gh/rsms/inter@v4.0/extras/ttf/Inter-Regular.ttf",
			{
				cache: "force-cache",
			},
		);

		if (!response.ok) {
			console.warn("Font loading failed, using system font");
			return null;
		}

		interFontCache = await response.arrayBuffer();
		return interFontCache;
	} catch {
		console.warn("Font loading failed, using system font");
		return null;
	}
}
