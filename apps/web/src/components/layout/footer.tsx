import { Github, Twitter } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { siteConfig } from "@/lib/seo/constants";

export function Footer() {
	return (
		<footer className="border-t border-card-border py-8">
			<Container>
				<div className="flex flex-col gap-6 text-sm text-muted-foreground">
					<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
						<div className="flex items-center gap-3 text-foreground">
							<Link
								href="/"
								className="flex items-center gap-2 font-medium hover:text-accent transition-colors"
							>
								<img
									src="/memoria.svg"
									alt=""
									className="w-4 h-4 dark:invert"
									aria-hidden="true"
								/>
								Memoria
							</Link>
							<span className="hidden sm:inline text-muted-foreground">·</span>
							<span className="text-muted-foreground">
								The memory your AI lacks.
							</span>
						</div>
						<div className="flex items-center gap-4">
							<Link
								href="/pricing"
								className="hover:text-foreground transition-colors"
							>
								Pricing
							</Link>
							<Link
								href="/tour"
								className="hover:text-foreground transition-colors"
							>
								Tour
							</Link>
							<Link
								href="/faq"
								className="hover:text-foreground transition-colors"
							>
								FAQ
							</Link>
							<Link
								href="/docs"
								className="hover:text-foreground transition-colors"
							>
								Docs
							</Link>
						</div>
					</div>
					<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
						<div className="flex items-center gap-4">
							<a
								href="https://x.com/byron_c_wade"
								target="_blank"
								rel="noopener noreferrer"
								className="hover:text-foreground transition-colors"
								aria-label="Follow on X (Twitter)"
							>
								<Twitter className="w-4 h-4" />
							</a>
							<a
								href={siteConfig.github}
								target="_blank"
								rel="noopener noreferrer"
								className="hover:text-foreground transition-colors"
								aria-label="View on GitHub"
							>
								<Github className="w-4 h-4" />
							</a>
						</div>
						<div className="flex items-center gap-2 text-muted-foreground">
							Built by{" "}
							<a
								href="https://github.com/byronwade"
								target="_blank"
								rel="noopener noreferrer"
								className="underline hover:text-foreground transition-colors"
							>
								Byron Wade
							</a>
						</div>
					</div>
				</div>
			</Container>
		</footer>
	);
}
