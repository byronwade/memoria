import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/layout/section";

export const metadata: Metadata = {
	title: "Privacy Policy",
	description: "Privacy Policy for Memoria - how we handle your data.",
};

export default function PrivacyPage() {
	return (
		<div className="min-h-screen bg-background text-foreground">
			<Section className="pt-24 md:pt-28 pb-10">
				<Container className="max-w-3xl">
					<div className="space-y-2 mb-8">
						<p className="text-sm text-muted-foreground">
							Last updated: December 2024
						</p>
						<h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
							Privacy Policy
						</h1>
					</div>

					<div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
						<section className="space-y-4">
							<h2 className="text-xl font-semibold text-foreground">Overview</h2>
							<p className="text-muted-foreground leading-relaxed">
								Memoria is designed with privacy as a core principle. We process your code diffs in-memory and never store your source code. This policy explains what data we collect and how we use it.
							</p>
						</section>

						<section className="space-y-4">
							<h2 className="text-xl font-semibold text-foreground">What We Collect</h2>

							<h3 className="text-lg font-medium text-foreground">Account Information</h3>
							<ul className="list-disc pl-6 space-y-2 text-muted-foreground">
								<li>Email address (for authentication and notifications)</li>
								<li>Name (optional, for personalization)</li>
								<li>GitHub username and OAuth tokens (for GitHub App integration)</li>
							</ul>

							<h3 className="text-lg font-medium text-foreground">Analysis Metadata</h3>
							<ul className="list-disc pl-6 space-y-2 text-muted-foreground">
								<li>Repository name and organization</li>
								<li>PR numbers and timestamps</li>
								<li>Risk scores and analysis results</li>
								<li>File paths mentioned in analyses (not file contents)</li>
							</ul>

							<h3 className="text-lg font-medium text-foreground">Usage Data</h3>
							<ul className="list-disc pl-6 space-y-2 text-muted-foreground">
								<li>Number of analyses performed</li>
								<li>Feature usage patterns</li>
								<li>Error logs for debugging</li>
							</ul>
						</section>

						<section className="space-y-4">
							<h2 className="text-xl font-semibold text-foreground">What We Don&apos;t Collect</h2>
							<ul className="list-disc pl-6 space-y-2 text-muted-foreground">
								<li><strong className="text-foreground">Source code</strong> - Diffs are processed in-memory and immediately discarded</li>
								<li><strong className="text-foreground">Secrets or credentials</strong> - We never access or store sensitive data from your repositories</li>
								<li><strong className="text-foreground">Private repository contents</strong> - Only metadata needed for analysis</li>
							</ul>
						</section>

						<section className="space-y-4">
							<h2 className="text-xl font-semibold text-foreground">How We Use Your Data</h2>
							<ul className="list-disc pl-6 space-y-2 text-muted-foreground">
								<li>To provide and improve the Service</li>
								<li>To display your analysis history in the dashboard</li>
								<li>To send important service notifications</li>
								<li>To enforce usage limits and billing</li>
								<li>To diagnose and fix technical issues</li>
							</ul>
						</section>

						<section className="space-y-4">
							<h2 className="text-xl font-semibold text-foreground">Data Retention</h2>
							<p className="text-muted-foreground leading-relaxed">
								Analysis metadata is retained for the duration of your subscription plus 30 days. Account data is retained until you delete your account. You can request data export or deletion at any time.
							</p>
						</section>

						<section className="space-y-4">
							<h2 className="text-xl font-semibold text-foreground">Data Security</h2>
							<p className="text-muted-foreground leading-relaxed">
								We use industry-standard security measures including:
							</p>
							<ul className="list-disc pl-6 space-y-2 text-muted-foreground">
								<li>TLS encryption for all data in transit</li>
								<li>Encrypted storage for data at rest</li>
								<li>Regular security audits and updates</li>
								<li>Minimal data collection principle</li>
							</ul>
						</section>

						<section className="space-y-4">
							<h2 className="text-xl font-semibold text-foreground">Third-Party Services</h2>
							<p className="text-muted-foreground leading-relaxed">
								We use the following third-party services:
							</p>
							<ul className="list-disc pl-6 space-y-2 text-muted-foreground">
								<li><strong className="text-foreground">GitHub</strong> - For OAuth authentication and repository access</li>
								<li><strong className="text-foreground">Stripe</strong> - For payment processing (we never see your full card number)</li>
								<li><strong className="text-foreground">Vercel</strong> - For hosting and analytics</li>
							</ul>
						</section>

						<section className="space-y-4">
							<h2 className="text-xl font-semibold text-foreground">Self-Hosted Option</h2>
							<p className="text-muted-foreground leading-relaxed">
								If you prefer complete data isolation, you can run Memoria entirely on your own infrastructure using the open-source MCP server and CLI. No data is sent to our servers in this configuration.
							</p>
						</section>

						<section className="space-y-4">
							<h2 className="text-xl font-semibold text-foreground">Your Rights</h2>
							<p className="text-muted-foreground leading-relaxed">
								You have the right to:
							</p>
							<ul className="list-disc pl-6 space-y-2 text-muted-foreground">
								<li>Access your personal data</li>
								<li>Export your data in a portable format</li>
								<li>Request correction of inaccurate data</li>
								<li>Request deletion of your data</li>
								<li>Opt out of marketing communications</li>
							</ul>
						</section>

						<section className="space-y-4">
							<h2 className="text-xl font-semibold text-foreground">Cookies</h2>
							<p className="text-muted-foreground leading-relaxed">
								We use essential cookies for authentication and session management. We do not use tracking cookies or sell data to advertisers.
							</p>
						</section>

						<section className="space-y-4">
							<h2 className="text-xl font-semibold text-foreground">Changes to This Policy</h2>
							<p className="text-muted-foreground leading-relaxed">
								We may update this policy from time to time. We will notify you of material changes by email or through the Service.
							</p>
						</section>

						<section className="space-y-4">
							<h2 className="text-xl font-semibold text-foreground">Contact</h2>
							<p className="text-muted-foreground leading-relaxed">
								For privacy-related questions or requests, contact us at{" "}
								<a href="mailto:privacy@byronwade.com" className="text-primary hover:underline">
									privacy@byronwade.com
								</a>
							</p>
						</section>

						<section className="pt-6 border-t border-border">
							<p className="text-sm text-muted-foreground">
								Also see our{" "}
								<Link href="/terms" className="text-primary hover:underline">
									Terms of Service
								</Link>
							</p>
						</section>
					</div>
				</Container>
			</Section>
		</div>
	);
}
