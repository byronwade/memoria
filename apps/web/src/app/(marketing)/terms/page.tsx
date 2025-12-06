import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/layout/section";

export const metadata: Metadata = {
	title: "Terms of Service",
	description: "Terms of Service for Memoria - the memory your AI lacks.",
};

export default function TermsPage() {
	return (
		<div className="min-h-screen bg-background text-foreground">
			<Section className="pt-24 md:pt-28 pb-10">
				<Container className="max-w-3xl">
					<div className="space-y-2 mb-8">
						<p className="text-sm text-muted-foreground">
							Last updated: December 2024
						</p>
						<h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
							Terms of Service
						</h1>
					</div>

					<div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
						<section className="space-y-4">
							<h2 className="text-xl font-semibold text-foreground">1. Acceptance of Terms</h2>
							<p className="text-muted-foreground leading-relaxed">
								By accessing or using Memoria (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.
							</p>
						</section>

						<section className="space-y-4">
							<h2 className="text-xl font-semibold text-foreground">2. Description of Service</h2>
							<p className="text-muted-foreground leading-relaxed">
								Memoria is an MCP server and analysis tool that provides git forensics capabilities to AI assistants. The Service includes:
							</p>
							<ul className="list-disc pl-6 space-y-2 text-muted-foreground">
								<li>Open-source MCP server and CLI tools</li>
								<li>GitHub App for automated PR analysis</li>
								<li>Web dashboard for repository management</li>
								<li>API access for programmatic use</li>
							</ul>
						</section>

						<section className="space-y-4">
							<h2 className="text-xl font-semibold text-foreground">3. User Accounts</h2>
							<p className="text-muted-foreground leading-relaxed">
								To access certain features, you must create an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.
							</p>
						</section>

						<section className="space-y-4">
							<h2 className="text-xl font-semibold text-foreground">4. Acceptable Use</h2>
							<p className="text-muted-foreground leading-relaxed">
								You agree not to:
							</p>
							<ul className="list-disc pl-6 space-y-2 text-muted-foreground">
								<li>Use the Service for any unlawful purpose</li>
								<li>Attempt to gain unauthorized access to any part of the Service</li>
								<li>Interfere with or disrupt the Service or servers</li>
								<li>Reverse engineer or attempt to extract source code</li>
								<li>Resell or redistribute the Service without authorization</li>
							</ul>
						</section>

						<section className="space-y-4">
							<h2 className="text-xl font-semibold text-foreground">5. Subscription and Billing</h2>
							<p className="text-muted-foreground leading-relaxed">
								Paid plans are billed monthly or annually. You may cancel at any time, and your access will continue until the end of your billing period. Refunds are provided at our discretion.
							</p>
						</section>

						<section className="space-y-4">
							<h2 className="text-xl font-semibold text-foreground">6. Data and Privacy</h2>
							<p className="text-muted-foreground leading-relaxed">
								Your use of the Service is also governed by our{" "}
								<Link href="/privacy" className="text-primary hover:underline">
									Privacy Policy
								</Link>
								. We process code diffs in-memory and do not store your source code. Metadata about analyses is retained for dashboard functionality.
							</p>
						</section>

						<section className="space-y-4">
							<h2 className="text-xl font-semibold text-foreground">7. Intellectual Property</h2>
							<p className="text-muted-foreground leading-relaxed">
								The Memoria core engine is open-source under the MIT License. The hosted Service, GitHub App, and dashboard are proprietary. You retain all rights to your code and repositories.
							</p>
						</section>

						<section className="space-y-4">
							<h2 className="text-xl font-semibold text-foreground">8. Disclaimer of Warranties</h2>
							<p className="text-muted-foreground leading-relaxed">
								THE SERVICE IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTIES OF ANY KIND. We do not guarantee that the Service will identify all code dependencies or prevent all bugs.
							</p>
						</section>

						<section className="space-y-4">
							<h2 className="text-xl font-semibold text-foreground">9. Limitation of Liability</h2>
							<p className="text-muted-foreground leading-relaxed">
								TO THE MAXIMUM EXTENT PERMITTED BY LAW, MEMORIA SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES ARISING FROM YOUR USE OF THE SERVICE.
							</p>
						</section>

						<section className="space-y-4">
							<h2 className="text-xl font-semibold text-foreground">10. Changes to Terms</h2>
							<p className="text-muted-foreground leading-relaxed">
								We may update these terms from time to time. We will notify you of material changes by email or through the Service. Continued use after changes constitutes acceptance.
							</p>
						</section>

						<section className="space-y-4">
							<h2 className="text-xl font-semibold text-foreground">11. Contact</h2>
							<p className="text-muted-foreground leading-relaxed">
								For questions about these Terms, contact us at{" "}
								<a href="mailto:legal@byronwade.com" className="text-primary hover:underline">
									legal@byronwade.com
								</a>
							</p>
						</section>
					</div>
				</Container>
			</Section>
		</div>
	);
}
