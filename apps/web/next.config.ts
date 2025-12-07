import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	experimental: {
		inlineCss: true,
	},
	// Allow Cloudflare tunnel and other dev origins
	allowedDevOrigins: [
		"such-divided-reproduced-clinical.trycloudflare.com",
	],
};

export default nextConfig;
