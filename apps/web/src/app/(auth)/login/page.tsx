import type { Metadata } from "next";
import Link from "next/link";
import { Github, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const metadata: Metadata = {
	title: "Login",
	description: "Sign in to your Memoria account to access your dashboard and manage your repositories.",
};

export default async function LoginPage({
	searchParams,
}: {
	searchParams: Promise<{ error?: string }>;
}) {
	const params = await searchParams;
	const error = params.error;

	return (
		<div className="min-h-screen bg-background flex items-center justify-center py-12 px-4">
			<Container size="sm" className="max-w-md">
				{error && (
					<Alert variant="destructive" className="mb-6">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>
							{decodeURIComponent(error)}
						</AlertDescription>
					</Alert>
				)}
				<div className="text-center mb-8">
					<Link href="/" className="inline-flex items-center gap-2 mb-6">
						<img
							src="/memoria.svg"
							alt=""
							className="w-8 h-8 dark:invert"
							aria-hidden="true"
						/>
						<span className="text-xl font-semibold">Memoria</span>
					</Link>
					<h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
					<p className="text-muted-foreground mt-2">
						Sign in with your GitHub or GitLab account to continue
					</p>
				</div>

				<Card>
					<CardHeader className="space-y-1 pb-4">
						<CardTitle className="text-lg">Sign in</CardTitle>
						<CardDescription>
							Connect with your source control provider
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						{/* GitHub OAuth */}
						<Button variant="outline" className="w-full h-11" asChild>
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
					</CardContent>
				</Card>

				<p className="text-center text-xs text-muted-foreground mt-6">
					By signing in, you agree to our{" "}
					<Link href="/terms" className="underline hover:text-foreground">
						Terms of Service
					</Link>{" "}
					and{" "}
					<Link href="/privacy" className="underline hover:text-foreground">
						Privacy Policy
					</Link>
				</p>
			</Container>
		</div>
	);
}
