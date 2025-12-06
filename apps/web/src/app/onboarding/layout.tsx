import Link from "next/link";

export default function OnboardingLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="min-h-screen bg-background">
			{/* Simple header */}
			<header className="border-b border-border/50">
				<div className="max-w-4xl mx-auto px-4 h-14 flex items-center">
					<Link href="/" className="flex items-center gap-2">
						<img
							src="/memoria.svg"
							alt="Memoria"
							className="h-6 w-6 dark:invert"
						/>
						<span className="font-semibold">Memoria</span>
					</Link>
				</div>
			</header>

			{/* Content */}
			<main className="max-w-4xl mx-auto px-4 py-12">
				{children}
			</main>
		</div>
	);
}
