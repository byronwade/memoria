"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode, useMemo } from "react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

export function ConvexClientProvider({ children }: { children: ReactNode }) {
	// Memoize the client once; if no URL is provided we skip wiring Convex to avoid runtime errors.
	const convexClient = useMemo(() => {
		if (!convexUrl) {
			if (process.env.NODE_ENV !== "production") {
				console.warn(
					"[Convex] NEXT_PUBLIC_CONVEX_URL is not set; Convex client is disabled."
				);
			}
			return null;
		}
		return new ConvexReactClient(convexUrl);
	}, []);

	if (!convexClient) {
		return <>{children}</>;
	}

	return <ConvexProvider client={convexClient}>{children}</ConvexProvider>;
}





