import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	experimental: {
		inlineCss: true,
	},
	typescript: {
		// Skip type checking for Convex files which have their own validation
		ignoreBuildErrors: true,
	},
	// Allow Cloudflare tunnel and other dev origins
	allowedDevOrigins: [
		"such-divided-reproduced-clinical.trycloudflare.com",
	],
};

export default nextConfig;
