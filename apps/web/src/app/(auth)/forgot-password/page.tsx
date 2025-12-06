import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
	title: "Forgot Password",
	description: "Reset your Memoria account password.",
};

export default function ForgotPasswordPage() {
	return (
		<div className="min-h-screen bg-background flex items-center justify-center py-12 px-4">
			<Container size="sm" className="max-w-md">
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
					<h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
					<p className="text-muted-foreground mt-2">
						Enter your email and we&apos;ll send you a reset link
					</p>
				</div>

				<Card>
					<CardHeader className="space-y-1 pb-4">
						<CardTitle className="text-lg">Forgot password?</CardTitle>
						<CardDescription>
							No worries, we&apos;ll send you reset instructions
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<form className="space-y-4">
							<div className="space-y-2">
								<label htmlFor="email" className="text-sm font-medium">
									Email
								</label>
								<Input
									id="email"
									type="email"
									placeholder="you@example.com"
									required
								/>
							</div>
							<Button type="submit" variant="cta" className="w-full">
								Send reset link
							</Button>
						</form>

						<div className="text-center">
							<Link
								href="/login"
								className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-2"
							>
								<ArrowLeft className="w-4 h-4" />
								Back to login
							</Link>
						</div>
					</CardContent>
				</Card>
			</Container>
		</div>
	);
}
