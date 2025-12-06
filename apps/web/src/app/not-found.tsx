import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
	title: "404 - Page Not Found | Memoria",
	description: "The page you're looking for doesn't exist.",
	robots: {
		index: false,
		follow: false,
	},
};

export default function NotFound() {
	return (
		<div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
			<div className="text-center max-w-md">
				<div className="mb-8">
					<span className="text-8xl font-bold text-accent">404</span>
				</div>
				<h1 className="text-2xl font-semibold mb-4">Page Not Found</h1>
				<p className="text-muted-foreground mb-8">
					The page you&apos;re looking for doesn&apos;t exist or has been moved.
				</p>
				<div className="flex flex-col sm:flex-row gap-4 justify-center">
					<Link
						href="/"
						className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors"
					>
						Go Home
					</Link>
					<Link
						href="/docs"
						className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-border text-foreground font-medium hover:bg-muted transition-colors"
					>
						View Docs
					</Link>
				</div>
			</div>
		</div>
	);
}
