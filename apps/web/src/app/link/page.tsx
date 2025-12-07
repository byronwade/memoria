import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Github, CheckCircle, AlertCircle, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export const metadata: Metadata = {
	title: "Link Device",
	description: "Link your CLI/MCP device to your Memoria account.",
};

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

async function getUser(sessionToken: string | undefined) {
	if (!sessionToken || !convexUrl) return null;

	try {
		const client = new ConvexHttpClient(convexUrl);
		const session = await client.query(api.sessions.getByToken, { sessionToken });

		if (!session || session.revokedAt || session.expiresAt < Date.now()) {
			return null;
		}

		const user = await client.query(api.users.getById, { userId: session.userId });
		return user;
	} catch {
		return null;
	}
}

async function linkDevice(deviceId: string, userId: Id<"users">) {
	if (!convexUrl) return { success: false, error: "Server not configured" };

	try {
		const client = new ConvexHttpClient(convexUrl);
		await client.mutation(api.devices.linkDevice, {
			deviceId,
			userId,
		});
		return { success: true };
	} catch (err) {
		return { success: false, error: (err as Error).message };
	}
}

export default async function LinkDevicePage({
	searchParams,
}: {
	searchParams: Promise<{ device?: string; error?: string; success?: string }>;
}) {
	const params = await searchParams;
	const deviceId = params.device;
	const error = params.error;
	const success = params.success;

	// Get current user session
	const cookieStore = await cookies();
	const sessionToken = cookieStore.get("memoria_session")?.value;
	const user = await getUser(sessionToken);

	// If no device ID provided, show error
	if (!deviceId) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center py-12 px-4">
				<Container size="sm" className="max-w-md">
					<div className="text-center mb-8">
						<Link href="/" className="inline-flex items-center gap-2 mb-6">
							<img src="/memoria.svg" alt="" className="w-8 h-8 dark:invert" aria-hidden="true" />
							<span className="text-xl font-semibold">Memoria</span>
						</Link>
					</div>

					<Card>
						<CardHeader className="space-y-1 pb-4">
							<CardTitle className="text-lg flex items-center gap-2">
								<AlertCircle className="w-5 h-5 text-destructive" />
								Missing Device ID
							</CardTitle>
							<CardDescription>
								No device ID was provided. Please run <code className="bg-muted px-1 rounded">memoria login</code> from your terminal.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="bg-muted rounded-lg p-4 font-mono text-sm">
								<span className="text-muted-foreground">$</span> npx @byronwade/memoria login
							</div>
						</CardContent>
					</Card>
				</Container>
			</div>
		);
	}

	// If user is logged in and we have a device, link it
	if (user && deviceId && !success) {
		const result = await linkDevice(deviceId, user._id);
		if (result.success) {
			redirect(`/link?device=${deviceId}&success=true`);
		} else {
			redirect(`/link?device=${deviceId}&error=${encodeURIComponent(result.error || "Failed to link device")}`);
		}
	}

	// Success state
	if (success) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center py-12 px-4">
				<Container size="sm" className="max-w-md">
					<div className="text-center mb-8">
						<Link href="/" className="inline-flex items-center gap-2 mb-6">
							<img src="/memoria.svg" alt="" className="w-8 h-8 dark:invert" aria-hidden="true" />
							<span className="text-xl font-semibold">Memoria</span>
						</Link>
					</div>

					<Card>
						<CardHeader className="space-y-1 pb-4">
							<CardTitle className="text-lg flex items-center gap-2 text-green-600 dark:text-green-400">
								<CheckCircle className="w-5 h-5" />
								Device Linked!
							</CardTitle>
							<CardDescription>
								Your device has been linked to your Memoria account.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<p className="text-sm text-muted-foreground">
								You can now close this window. Your CLI and MCP server will automatically connect to your account.
							</p>

							<div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg p-4">
								<div className="flex items-start gap-3">
									<Terminal className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
									<div className="text-sm">
										<p className="font-medium text-green-800 dark:text-green-200">Next steps:</p>
										<ul className="mt-2 space-y-1 text-green-700 dark:text-green-300">
											<li>Memories will auto-save to your account</li>
											<li>Check <code className="bg-green-100 dark:bg-green-900 px-1 rounded">memoria status</code> to verify</li>
										</ul>
									</div>
								</div>
							</div>

							<Button variant="outline" className="w-full" asChild>
								<Link href="/dashboard">Go to Dashboard</Link>
							</Button>
						</CardContent>
					</Card>
				</Container>
			</div>
		);
	}

	// Not logged in - show login flow with device linking
	return (
		<div className="min-h-screen bg-background flex items-center justify-center py-12 px-4">
			<Container size="sm" className="max-w-md">
				{error && (
					<Alert variant="destructive" className="mb-6">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>{decodeURIComponent(error)}</AlertDescription>
					</Alert>
				)}

				<div className="text-center mb-8">
					<Link href="/" className="inline-flex items-center gap-2 mb-6">
						<img src="/memoria.svg" alt="" className="w-8 h-8 dark:invert" aria-hidden="true" />
						<span className="text-xl font-semibold">Memoria</span>
					</Link>
					<h1 className="text-2xl font-semibold tracking-tight">Link Your Device</h1>
					<p className="text-muted-foreground mt-2">
						Sign in to connect your CLI to your Memoria account
					</p>
				</div>

				<Card>
					<CardHeader className="space-y-1 pb-4">
						<CardTitle className="text-lg flex items-center gap-2">
							<Terminal className="w-5 h-5" />
							Device Linking
						</CardTitle>
						<CardDescription>
							Connecting device <code className="bg-muted px-1 rounded text-xs">{deviceId.substring(0, 8)}...</code>
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						<Button variant="outline" className="w-full h-11" asChild>
							<a href={`/api/auth/github?returnTo=/link?device=${deviceId}`}>
								<Github className="w-5 h-5 mr-2" />
								Continue with GitHub
							</a>
						</Button>

						<Button variant="outline" className="w-full h-11" disabled>
							<svg className="w-5 h-5 mr-2 opacity-50" viewBox="0 0 24 24" fill="currentColor">
								<path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z"/>
							</svg>
							GitLab (Coming Soon)
						</Button>

						<p className="text-center text-xs text-muted-foreground pt-2">
							Once signed in, your device will be linked to your account and can save memories automatically.
						</p>
					</CardContent>
				</Card>

				<p className="text-center text-xs text-muted-foreground mt-6">
					By signing in, you agree to our{" "}
					<Link href="/terms" className="underline hover:text-foreground">Terms of Service</Link>
					{" "}and{" "}
					<Link href="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>
				</p>
			</Container>
		</div>
	);
}
