"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
	Check,
	Github,
	CreditCard,
	Rocket,
	ChevronRight,
	Lock,
	Loader2,
	ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface OnboardingStatus {
	hasOrganization: boolean;
	hasInstallation: boolean;
	hasRepositories: boolean;
	hasBillingSetup: boolean;
	organization: {
		_id: string;
		name: string;
		status: string;
		trialEndsAt: number | null;
	} | null;
	installations: Array<{
		_id: string;
		accountLogin: string;
		status: string;
	}>;
	repositories: Array<{
		_id: string;
		fullName: string;
		isActive: boolean;
		isPrivate: boolean;
	}>;
}

interface OnboardingFlowProps {
	userId: string;
	userEmail: string;
	userName?: string;
	status: OnboardingStatus;
}

type Step = "connect" | "repos" | "plan" | "complete";

export function OnboardingFlow({ userId, userEmail, userName, status }: OnboardingFlowProps) {
	const router = useRouter();

	// Determine initial step based on status
	const getInitialStep = (): Step => {
		// If user has installation and repos (even if none active), go to repos step
		if (status.hasInstallation && status.repositories.length > 0) {
			return status.hasRepositories ? "plan" : "repos";
		}
		// No installation, need to connect GitHub
		return "connect";
	};

	const [currentStep, setCurrentStep] = useState<Step>(getInitialStep());
	const [isLoading, setIsLoading] = useState(false);
	const [isPolling, setIsPolling] = useState(false);
	const [repositories, setRepositories] = useState(status.repositories);
	const [selectedRepos, setSelectedRepos] = useState<Set<string>>(
		new Set(status.repositories.filter(r => r.isActive).map(r => r._id))
	);
	const [selectedPlan, setSelectedPlan] = useState<"free" | "solo" | "team">("free");
	const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const githubWindowRef = useRef<Window | null>(null);

	// Check installation status
	const checkInstallationStatus = useCallback(async () => {
		try {
			const response = await fetch("/api/github/installation-status");
			if (response.ok) {
				const data = await response.json();
				if (data.hasInstallation) {
					// Stop polling
					if (pollingIntervalRef.current) {
						clearInterval(pollingIntervalRef.current);
						pollingIntervalRef.current = null;
					}
					setIsPolling(false);
					setRepositories(data.repositories || []);
					// Auto-advance to repos step
					setCurrentStep("repos");
					// Close the GitHub window if still open
					if (githubWindowRef.current && !githubWindowRef.current.closed) {
						githubWindowRef.current.close();
					}
				}
			}
		} catch (error) {
			console.error("Failed to check installation status:", error);
		}
	}, []);

	// Start polling when waiting for installation
	useEffect(() => {
		if (isPolling) {
			// Check immediately
			checkInstallationStatus();
			// Then check every 2 seconds
			pollingIntervalRef.current = setInterval(checkInstallationStatus, 2000);
		}

		return () => {
			if (pollingIntervalRef.current) {
				clearInterval(pollingIntervalRef.current);
			}
		};
	}, [isPolling, checkInstallationStatus]);

	// Listen for message from GitHub callback window
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			if (event.data?.type === 'github-installation-complete' && event.data?.success) {
				// Immediately check installation status
				checkInstallationStatus();
			}
		};

		window.addEventListener('message', handleMessage);
		return () => window.removeEventListener('message', handleMessage);
	}, [checkInstallationStatus]);

	// Check if GitHub window was closed
	useEffect(() => {
		if (!isPolling || !githubWindowRef.current) return;

		const checkWindowClosed = setInterval(() => {
			if (githubWindowRef.current?.closed) {
				// Window was closed, keep polling for a bit longer in case they completed installation
				clearInterval(checkWindowClosed);
			}
		}, 500);

		return () => clearInterval(checkWindowClosed);
	}, [isPolling]);

	const steps: { id: Step; label: string; description: string }[] = [
		{ id: "connect", label: "Connect GitHub", description: "Install the Memoria GitHub App" },
		{ id: "repos", label: "Select Repositories", description: "Choose which repos to analyze" },
		{ id: "plan", label: "Choose Plan", description: "Start with free or upgrade" },
		{ id: "complete", label: "Complete", description: "You're all set!" },
	];

	const getStepStatus = (stepId: Step) => {
		const stepOrder: Step[] = ["connect", "repos", "plan", "complete"];
		const currentIndex = stepOrder.indexOf(currentStep);
		const stepIndex = stepOrder.indexOf(stepId);

		if (stepIndex < currentIndex) return "complete";
		if (stepIndex === currentIndex) return "current";
		return "upcoming";
	};

	const handleConnectGitHub = () => {
		// Open GitHub App installation in a new tab
		const appName = process.env.NEXT_PUBLIC_GITHUB_APP_NAME || "memoria-pr";
		const installUrl = `https://github.com/apps/${appName}/installations/new`;

		githubWindowRef.current = window.open(installUrl, "_blank", "noopener,noreferrer");

		// Start polling for installation
		setIsPolling(true);
	};

	const handleToggleRepo = (repoId: string) => {
		const newSelected = new Set(selectedRepos);
		if (newSelected.has(repoId)) {
			newSelected.delete(repoId);
		} else {
			// Check plan limits
			if (selectedPlan === "free" && newSelected.size >= 1) {
				// Show upgrade prompt
				alert("Free plan only allows 1 repository. Upgrade to add more.");
				return;
			}
			if (selectedPlan === "solo" && newSelected.size >= 5) {
				alert("Solo plan allows up to 5 repositories. Upgrade to Team for more.");
				return;
			}
			newSelected.add(repoId);
		}
		setSelectedRepos(newSelected);
	};

	const handleSaveRepos = async () => {
		setIsLoading(true);
		try {
			const response = await fetch("/api/onboarding/save-repos", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					orgId: status.organization?._id,
					repoIds: Array.from(selectedRepos),
				}),
			});

			if (response.ok) {
				setCurrentStep("plan");
			}
		} catch (error) {
			console.error("Failed to save repos:", error);
		} finally {
			setIsLoading(false);
		}
	};

	const handleSelectPlan = async (plan: "free" | "solo" | "team") => {
		setSelectedPlan(plan);

		if (plan === "free") {
			// Just proceed to dashboard
			router.push("/dashboard");
			return;
		}

		// For paid plans, create checkout session
		setIsLoading(true);
		try {
			const response = await fetch("/api/billing/create-checkout", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					orgId: status.organization?._id,
					planTier: plan,
					successUrl: `${window.location.origin}/dashboard?upgraded=true`,
					cancelUrl: `${window.location.origin}/onboarding`,
				}),
			});

			const data = await response.json();
			if (data.url) {
				window.location.href = data.url;
			}
		} catch (error) {
			console.error("Failed to create checkout:", error);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="space-y-8">
			{/* Progress Steps */}
			<div className="flex items-center justify-center">
				<div className="flex items-center gap-2">
					{steps.map((step, index) => {
						const stepStatus = getStepStatus(step.id);
						return (
							<div key={step.id} className="flex items-center">
								<div
									className={cn(
										"flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors",
										stepStatus === "complete" && "bg-primary text-primary-foreground",
										stepStatus === "current" && "bg-primary text-primary-foreground",
										stepStatus === "upcoming" && "bg-muted text-muted-foreground"
									)}
								>
									{stepStatus === "complete" ? (
										<Check className="w-4 h-4" />
									) : (
										index + 1
									)}
								</div>
								<span
									className={cn(
										"ml-2 text-sm font-medium hidden sm:inline",
										stepStatus === "current" && "text-foreground",
										stepStatus !== "current" && "text-muted-foreground"
									)}
								>
									{step.label}
								</span>
								{index < steps.length - 1 && (
									<ChevronRight className="w-4 h-4 mx-2 text-muted-foreground" />
								)}
							</div>
						);
					})}
				</div>
			</div>

			{/* Step Content */}
			<div className="max-w-2xl mx-auto">
				{currentStep === "connect" && (
					<Card>
						<CardHeader className="text-center">
							<div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
								{isPolling ? (
									<Loader2 className="w-6 h-6 text-primary animate-spin" />
								) : (
									<Github className="w-6 h-6 text-primary" />
								)}
							</div>
							<CardTitle>
								{isPolling ? "Waiting for Installation..." : "Connect Your GitHub Account"}
							</CardTitle>
							<CardDescription>
								{isPolling
									? "Complete the installation in the new tab. This page will automatically update once connected."
									: "Install the Memoria GitHub App to enable automatic PR analysis. We'll analyze your code changes and provide risk assessments."}
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{!isPolling && (
								<div className="bg-muted/50 rounded-lg p-4 space-y-2">
									<h4 className="font-medium text-sm">What we'll access:</h4>
									<ul className="text-sm text-muted-foreground space-y-1">
										<li className="flex items-center gap-2">
											<Check className="w-4 h-4 text-primary" />
											Read repository contents for analysis
										</li>
										<li className="flex items-center gap-2">
											<Check className="w-4 h-4 text-primary" />
											Read and write pull request comments
										</li>
										<li className="flex items-center gap-2">
											<Check className="w-4 h-4 text-primary" />
											Receive webhook events for PRs
										</li>
									</ul>
								</div>
							)}

							{isPolling ? (
								<div className="space-y-3">
									<div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
										<Loader2 className="w-4 h-4 animate-spin" />
										Checking for installation...
									</div>
									<Button
										variant="outline"
										className="w-full"
										onClick={handleConnectGitHub}
									>
										<ExternalLink className="w-4 h-4 mr-2" />
										Reopen GitHub Tab
									</Button>
								</div>
							) : (
								<Button
									className="w-full"
									size="lg"
									onClick={handleConnectGitHub}
									disabled={isLoading}
								>
									<Github className="w-4 h-4 mr-2" />
									Install GitHub App
									<ExternalLink className="w-4 h-4 ml-2" />
								</Button>
							)}

							<p className="text-xs text-center text-muted-foreground">
								{isPolling
									? "The GitHub app will open in a new tab"
									: "You can revoke access anytime from your GitHub settings"}
							</p>
						</CardContent>
					</Card>
				)}

				{currentStep === "repos" && (
					<Card>
						<CardHeader className="text-center">
							<CardTitle>Select Repositories</CardTitle>
							<CardDescription>
								Choose which repositories you want Memoria to analyze.
								{selectedPlan === "free" && " Free plan includes 1 repository."}
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{repositories.length === 0 ? (
								<div className="text-center py-8 text-muted-foreground">
									<p>No repositories found.</p>
									<p className="text-sm mt-2">
										Make sure the GitHub App has access to your repositories.
									</p>
								</div>
							) : (
								<div className="space-y-2 max-h-80 overflow-y-auto">
									{repositories.map((repo) => (
										<div
											key={repo._id}
											onClick={() => handleToggleRepo(repo._id)}
											className={cn(
												"flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
												selectedRepos.has(repo._id)
													? "border-primary bg-primary/5"
													: "border-border hover:border-primary/50"
											)}
										>
											<div
												className={cn(
													"w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
													selectedRepos.has(repo._id)
														? "border-primary bg-primary"
														: "border-muted-foreground/30"
												)}
											>
												{selectedRepos.has(repo._id) && (
													<Check className="w-3 h-3 text-primary-foreground" />
												)}
											</div>
											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-2">
													<span className="font-medium truncate">{repo.fullName}</span>
													{repo.isPrivate && (
														<Lock className="w-3 h-3 text-muted-foreground" />
													)}
												</div>
											</div>
										</div>
									))}
								</div>
							)}

							<div className="flex items-center justify-between pt-4 border-t">
								<span className="text-sm text-muted-foreground">
									{selectedRepos.size} selected
								</span>
								<Button
									onClick={handleSaveRepos}
									disabled={selectedRepos.size === 0 || isLoading}
								>
									{isLoading ? (
										<Loader2 className="w-4 h-4 mr-2 animate-spin" />
									) : null}
									Continue
									<ChevronRight className="w-4 h-4 ml-2" />
								</Button>
							</div>
						</CardContent>
					</Card>
				)}

				{currentStep === "plan" && (
					<div className="space-y-6">
						<div className="text-center">
							<h2 className="text-2xl font-semibold">Choose Your Plan</h2>
							<p className="text-muted-foreground mt-2">
								Start with a free repository or upgrade for more
							</p>
						</div>

						<div className="grid md:grid-cols-3 gap-4">
							{/* Free Plan */}
							<Card
								className={cn(
									"cursor-pointer transition-all",
									selectedPlan === "free" && "ring-2 ring-primary"
								)}
								onClick={() => setSelectedPlan("free")}
							>
								<CardHeader>
									<CardTitle className="flex items-center justify-between">
										Free
										{selectedPlan === "free" && (
											<Check className="w-5 h-5 text-primary" />
										)}
									</CardTitle>
									<CardDescription>
										<span className="text-2xl font-bold text-foreground">$0</span>
										<span className="text-muted-foreground">/month</span>
									</CardDescription>
								</CardHeader>
								<CardContent>
									<ul className="space-y-2 text-sm">
										<li className="flex items-center gap-2">
											<Check className="w-4 h-4 text-primary" />
											1 repository
										</li>
										<li className="flex items-center gap-2">
											<Check className="w-4 h-4 text-primary" />
											50 PR analyses/month
										</li>
										<li className="flex items-center gap-2">
											<Check className="w-4 h-4 text-primary" />
											Basic risk reports
										</li>
									</ul>
								</CardContent>
							</Card>

							{/* Solo Plan */}
							<Card
								className={cn(
									"cursor-pointer transition-all relative",
									selectedPlan === "solo" && "ring-2 ring-primary"
								)}
								onClick={() => setSelectedPlan("solo")}
							>
								<div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-medium px-2 py-0.5 rounded-full">
									Popular
								</div>
								<CardHeader>
									<CardTitle className="flex items-center justify-between">
										Solo
										{selectedPlan === "solo" && (
											<Check className="w-5 h-5 text-primary" />
										)}
									</CardTitle>
									<CardDescription>
										<span className="text-2xl font-bold text-foreground">$19</span>
										<span className="text-muted-foreground">/month</span>
									</CardDescription>
								</CardHeader>
								<CardContent>
									<ul className="space-y-2 text-sm">
										<li className="flex items-center gap-2">
											<Check className="w-4 h-4 text-primary" />
											5 repositories
										</li>
										<li className="flex items-center gap-2">
											<Check className="w-4 h-4 text-primary" />
											500 PR analyses/month
										</li>
										<li className="flex items-center gap-2">
											<Check className="w-4 h-4 text-primary" />
											Full risk reports
										</li>
										<li className="flex items-center gap-2">
											<Check className="w-4 h-4 text-primary" />
											Priority support
										</li>
									</ul>
								</CardContent>
							</Card>

							{/* Team Plan */}
							<Card
								className={cn(
									"cursor-pointer transition-all",
									selectedPlan === "team" && "ring-2 ring-primary"
								)}
								onClick={() => setSelectedPlan("team")}
							>
								<CardHeader>
									<CardTitle className="flex items-center justify-between">
										Team
										{selectedPlan === "team" && (
											<Check className="w-5 h-5 text-primary" />
										)}
									</CardTitle>
									<CardDescription>
										<span className="text-2xl font-bold text-foreground">$49</span>
										<span className="text-muted-foreground">/month</span>
									</CardDescription>
								</CardHeader>
								<CardContent>
									<ul className="space-y-2 text-sm">
										<li className="flex items-center gap-2">
											<Check className="w-4 h-4 text-primary" />
											25 repositories
										</li>
										<li className="flex items-center gap-2">
											<Check className="w-4 h-4 text-primary" />
											2500 PR analyses/month
										</li>
										<li className="flex items-center gap-2">
											<Check className="w-4 h-4 text-primary" />
											Team dashboard
										</li>
										<li className="flex items-center gap-2">
											<Check className="w-4 h-4 text-primary" />
											API access
										</li>
									</ul>
								</CardContent>
							</Card>
						</div>

						<div className="flex justify-center pt-4">
							<Button
								size="lg"
								onClick={() => handleSelectPlan(selectedPlan)}
								disabled={isLoading}
							>
								{isLoading ? (
									<Loader2 className="w-4 h-4 mr-2 animate-spin" />
								) : selectedPlan === "free" ? (
									<Rocket className="w-4 h-4 mr-2" />
								) : (
									<CreditCard className="w-4 h-4 mr-2" />
								)}
								{selectedPlan === "free" ? "Start Free" : "Continue to Payment"}
							</Button>
						</div>

						{selectedPlan !== "free" && (
							<p className="text-xs text-center text-muted-foreground">
								14-day free trial. Cancel anytime. No credit card required to start.
							</p>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
