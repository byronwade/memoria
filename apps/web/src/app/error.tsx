"use client";

import { useEffect } from "react";

export default function Error({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		console.error(error);
	}, [error]);

	return (
		<div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
			<div className="text-center max-w-md">
				<div className="mb-8">
					<span className="text-6xl font-bold text-destructive">Error</span>
				</div>
				<h1 className="text-2xl font-semibold mb-4">Something went wrong</h1>
				<p className="text-muted-foreground mb-8">
					An unexpected error occurred. Please try again or contact support if
					the problem persists.
				</p>
				<div className="flex flex-col sm:flex-row gap-4 justify-center">
					<button
						type="button"
						onClick={reset}
						className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors"
					>
						Try Again
					</button>
					<a
						href="/"
						className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-border text-foreground font-medium hover:bg-muted transition-colors"
					>
						Go Home
					</a>
				</div>
			</div>
		</div>
	);
}
