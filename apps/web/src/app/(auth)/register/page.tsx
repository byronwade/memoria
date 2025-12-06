import type { Metadata } from "next";
import Link from "next/link";
import { Github, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
	title: "Register",
	description: "Create your Memoria account and start protecting your codebase from breaking changes.",
};

const benefits = [
	"14-day free trial, no credit card required",
	"GitHub App for automated PR analysis",
	"Risk & Impact reports on every PR",
	"Cancel anytime",
];

export default function RegisterPage() {
	return (
		<div className="min-h-screen bg-background flex items-center justify-center py-12 px-4">
			<Container size="lg" className="max-w-4xl">
				<div className="grid md:grid-cols-2 gap-12 items-center">
					{/* Left side - Benefits */}
					<div className="hidden md:block space-y-6">
						<Link href="/" className="inline-flex items-center gap-2">
							<img
								src="/memoria.svg"
								alt=""
								className="w-8 h-8 dark:invert"
								aria-hidden="true"
							/>
							<span className="text-xl font-semibold">Memoria</span>
						</Link>
						<h1 className="text-3xl font-semibold tracking-tight">
							Give your AI the memory it lacks
						</h1>
						<p className="text-muted-foreground">
							Stop breaking production. Memoria analyzes your git history to reveal hidden file dependencies before your AI makes changes.
						</p>
						<ul className="space-y-3">
							{benefits.map((benefit) => (
								<li key={benefit} className="flex items-center gap-3 text-muted-foreground">
									<div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
										<Check className="w-3 h-3 text-primary" />
									</div>
									{benefit}
								</li>
							))}
						</ul>
					</div>

					{/* Right side - OAuth */}
					<div>
						<div className="text-center mb-6 md:hidden">
							<Link href="/" className="inline-flex items-center gap-2 mb-4">
								<img
									src="/memoria.svg"
									alt=""
									className="w-8 h-8 dark:invert"
									aria-hidden="true"
								/>
								<span className="text-xl font-semibold">Memoria</span>
							</Link>
							<h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
						</div>

						<Card>
							<CardHeader className="space-y-1 pb-4">
								<CardTitle className="text-lg">Get started free</CardTitle>
								<CardDescription>
									Connect your source control to start your 14-day free trial
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-3">
								{/* GitHub OAuth */}
								<Button variant="cta" className="w-full h-11" asChild>
									<a href="/api/auth/github">
										<Github className="w-5 h-5 mr-2" />
										Continue with GitHub
									</a>
								</Button>

								{/* GitLab OAuth - Coming Soon */}
								<Button variant="outline" className="w-full h-11" disabled>
									<svg className="w-5 h-5 mr-2 opacity-50" viewBox="0 0 24 24" fill="currentColor">
										<path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z"/>
									</svg>
									GitLab (Coming Soon)
								</Button>

								<p className="text-center text-xs text-muted-foreground pt-2">
									Memoria requires access to your repositories to analyze code changes and provide risk assessments.
								</p>

								<p className="text-center text-sm text-muted-foreground pt-2">
									Already have an account?{" "}
									<Link href="/login" className="text-primary hover:underline">
										Sign in
									</Link>
								</p>
							</CardContent>
						</Card>

						<p className="text-center text-xs text-muted-foreground mt-6">
							By registering, you agree to our{" "}
							<Link href="/terms" className="underline hover:text-foreground">
								Terms of Service
							</Link>{" "}
							and{" "}
							<Link href="/privacy" className="underline hover:text-foreground">
								Privacy Policy
							</Link>
						</p>
					</div>
				</div>
			</Container>
		</div>
	);
}
