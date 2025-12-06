"use client";

import {
	Bell,
	Check,
	ChevronRight,
	Copy,
	CreditCard,
	ExternalLink,
	FolderGit2,
	Github,
	Key,
	Loader2,
	Lock,
	Mail,
	Plus,
	RefreshCw,
	Shield,
	Smartphone,
	Trash2,
	User,
	Zap,
} from "lucide-react";
import { useState, useEffect, useCallback, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useDashboard } from "../../dashboard-context";

interface Installation {
	_id: string;
	accountLogin: string;
	status: string;
	providerType: string;
	providerInstallationId: string;
}

interface TeamToken {
	_id: string;
	name: string;
	createdAt: number;
	lastUsedAt: number | null;
	revokedAt: number | null;
	creatorName: string;
	maskedToken: string;
}

export default function SettingsPage() {
	const router = useRouter();
	const { user, billingStatus, activeRepos, repoLimit, repositories, canAddRepo } = useDashboard();
	// Team tokens state
	const [teamTokens, setTeamTokens] = useState<TeamToken[]>([]);
	const [loadingTokens, setLoadingTokens] = useState(true);
	const [creatingToken, setCreatingToken] = useState(false);
	const [newTokenName, setNewTokenName] = useState("");
	const [showNewToken, setShowNewToken] = useState<string | null>(null);
	const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);
	const [revokingTokenId, setRevokingTokenId] = useState<string | null>(null);
	const newTokenRef = useRef<HTMLInputElement>(null);

	const [installations, setInstallations] = useState<Installation[]>([]);
	const [loadingInstallations, setLoadingInstallations] = useState(true);
	const [updatingRepo, setUpdatingRepo] = useState<string | null>(null);
	const [repoStatuses, setRepoStatuses] = useState<Record<string, boolean>>({});
	const [isRefreshing, startRefreshTransition] = useTransition();

	// Initialize repo statuses from repositories
	useEffect(() => {
		const statuses: Record<string, boolean> = {};
		repositories.forEach(r => {
			statuses[r._id] = r.isActive;
		});
		setRepoStatuses(statuses);
	}, [repositories]);

	// Fetch installations on mount
	useEffect(() => {
		async function fetchInstallations() {
			try {
				const res = await fetch("/api/github/installation-status");
				if (res.ok) {
					const data = await res.json();
					setInstallations(data.installations || []);
				}
			} catch (error) {
				console.error("Failed to fetch installations:", error);
			} finally {
				setLoadingInstallations(false);
			}
		}
		fetchInstallations();
	}, []);

	// Fetch team tokens on mount
	useEffect(() => {
		async function fetchTokens() {
			try {
				const res = await fetch("/api/team-tokens");
				if (res.ok) {
					const data = await res.json();
					setTeamTokens(data.tokens || []);
				}
			} catch (error) {
				console.error("Failed to fetch team tokens:", error);
			} finally {
				setLoadingTokens(false);
			}
		}
		fetchTokens();
	}, []);

	// Create a new team token
	const handleCreateToken = useCallback(async () => {
		if (!newTokenName.trim()) {
			toast.error("Token name required", {
				description: "Please enter a name for your token.",
			});
			return;
		}

		setCreatingToken(true);
		try {
			const res = await fetch("/api/team-tokens", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: newTokenName.trim() }),
			});

			if (res.ok) {
				const data = await res.json();
				setShowNewToken(data.token);
				setNewTokenName("");
				// Refresh token list
				const refreshRes = await fetch("/api/team-tokens");
				if (refreshRes.ok) {
					const refreshData = await refreshRes.json();
					setTeamTokens(refreshData.tokens || []);
				}
				toast.success("Token created", {
					description: "Make sure to copy your token now. You won't be able to see it again.",
				});
			} else {
				const error = await res.json();
				toast.error("Failed to create token", {
					description: error.error || "Please try again.",
				});
			}
		} catch (error) {
			console.error("Failed to create token:", error);
			toast.error("Network error", {
				description: "Could not connect to server.",
			});
		} finally {
			setCreatingToken(false);
		}
	}, [newTokenName]);

	// Copy token to clipboard
	const handleCopyToken = useCallback(async (token: string, tokenId?: string) => {
		try {
			await navigator.clipboard.writeText(token);
			if (tokenId) {
				setCopiedTokenId(tokenId);
				setTimeout(() => setCopiedTokenId(null), 2000);
			}
			toast.success("Copied to clipboard");
		} catch (error) {
			console.error("Failed to copy:", error);
			toast.error("Failed to copy");
		}
	}, []);

	// Revoke a token
	const handleRevokeToken = useCallback(async (tokenId: string, tokenName: string) => {
		setRevokingTokenId(tokenId);
		try {
			const res = await fetch(`/api/team-tokens/${tokenId}`, {
				method: "DELETE",
			});

			if (res.ok) {
				setTeamTokens((prev) => prev.filter((t) => t._id !== tokenId));
				toast.success("Token revoked", {
					description: `"${tokenName}" has been revoked and can no longer be used.`,
				});
			} else {
				toast.error("Failed to revoke token", {
					description: "Please try again.",
				});
			}
		} catch (error) {
			console.error("Failed to revoke token:", error);
			toast.error("Network error", {
				description: "Could not connect to server.",
			});
		} finally {
			setRevokingTokenId(null);
		}
	}, []);

	const handleToggleRepo = useCallback(async (repoId: string, currentStatus: boolean, repoName: string) => {
		const newStatus = !currentStatus;

		// Check if we're activating and at limit
		if (newStatus && !canAddRepo) {
			toast.error("Repository limit reached", {
				description: "Upgrade your plan to monitor more repositories.",
			});
			return;
		}

		setUpdatingRepo(repoId);

		// Optimistically update UI
		setRepoStatuses(prev => ({ ...prev, [repoId]: newStatus }));

		try {
			const res = await fetch(`/api/repositories/${repoId}/status`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ isActive: newStatus }),
			});

			if (!res.ok) {
				// Revert on error
				setRepoStatuses(prev => ({ ...prev, [repoId]: currentStatus }));
				toast.error("Failed to update repository", {
					description: "Could not change monitoring status. Please try again.",
				});
			} else {
				toast.success(newStatus ? "Monitoring enabled" : "Monitoring disabled", {
					description: `${repoName} is ${newStatus ? "now being monitored" : "no longer monitored"}.`,
				});
				// Refresh the page to get updated context with transition
				startRefreshTransition(() => {
					router.refresh();
				});
			}
		} catch (error) {
			// Revert on error
			setRepoStatuses(prev => ({ ...prev, [repoId]: currentStatus }));
			console.error("Failed to update repository status:", error);
			toast.error("Network error", {
				description: "Could not connect to server. Please try again.",
			});
		} finally {
			setUpdatingRepo(null);
		}
	}, [canAddRepo, router]);

	// Calculate usage percentages
	const repoUsagePercent = repoLimit === -1 ? 0 : Math.min(100, (activeRepos.length / repoLimit) * 100);
	const isRepoLimitReached = repoLimit !== -1 && activeRepos.length >= repoLimit;

	// Format plan price
	const planPrice = billingStatus?.plan?.pricePerMonthUsd ?? 0;
	const planName = billingStatus?.plan?.name ?? "Free";

	// Get GitHub installation info
	const githubInstallation = installations.find(i => i.providerType === "github" && i.status === "active");

	return (
		<div className="pb-16">
			{/* Header */}
			<div className="max-w-4xl mx-auto px-4 md:px-6 pt-8">
				<h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
				<p className="text-muted-foreground mt-1">
					Manage your account, billing, and preferences
				</p>
			</div>

			{/* Content */}
			<div className="max-w-4xl mx-auto px-4 md:px-6 mt-10 space-y-12">

				{/* ============================================ */}
				{/* PROFILE SECTION */}
				{/* ============================================ */}
				<section>
					<div className="flex items-center gap-3 mb-6">
						<div className="w-9 h-9 rounded-sm bg-secondary/50 border border-border/50 flex items-center justify-center">
							<User className="h-4.5 w-4.5 text-muted-foreground" />
						</div>
						<div>
							<h2 className="font-medium">Profile</h2>
							<p className="text-sm text-muted-foreground">Your personal information</p>
						</div>
					</div>

					<div className="p-5 rounded-sm bg-secondary/30 border border-border/50 space-y-6">
						{/* Avatar Row */}
						<div className="flex items-center gap-4">
							{user.avatarUrl ? (
								<img
									src={user.avatarUrl}
									alt="Profile"
									className="w-16 h-16 rounded-sm border border-border/50"
								/>
							) : (
								<div className="w-16 h-16 rounded-sm border border-border/50 bg-secondary/50 flex items-center justify-center">
									<User className="h-8 w-8 text-muted-foreground" />
								</div>
							)}
							<div className="flex-1">
								<div className="font-medium">{user.name || "Anonymous User"}</div>
								<div className="text-sm text-muted-foreground">{user.email}</div>
							</div>
							<Button variant="outline" size="sm" disabled>Change Photo</Button>
						</div>

						<div className="h-px bg-border/50" />

						{/* Form Fields */}
						<div className="grid gap-5 sm:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="name" className="text-sm text-muted-foreground">Full Name</Label>
								<Input id="name" defaultValue={user.name || ""} placeholder="Enter your name" />
							</div>
							<div className="space-y-2">
								<Label htmlFor="email" className="text-sm text-muted-foreground">Email Address</Label>
								<Input id="email" type="email" defaultValue={user.email} disabled />
							</div>
						</div>

						<div className="flex justify-end">
							<Button size="sm" disabled>Save Changes</Button>
						</div>
					</div>
				</section>

				{/* ============================================ */}
				{/* CONNECTED ACCOUNTS SECTION */}
				{/* ============================================ */}
				<section>
					<div className="flex items-center gap-3 mb-6">
						<div className="w-9 h-9 rounded-sm bg-secondary/50 border border-border/50 flex items-center justify-center">
							<Github className="h-4.5 w-4.5 text-muted-foreground" />
						</div>
						<div>
							<h2 className="font-medium">Connected Accounts</h2>
							<p className="text-sm text-muted-foreground">Manage your linked accounts</p>
						</div>
					</div>

					<div className="space-y-3">
						{/* GitHub */}
						{loadingInstallations ? (
							<div className="p-4 rounded-sm bg-secondary/30 border border-border/50 flex items-center gap-4">
								<div className="w-10 h-10 rounded-sm bg-[#24292e] flex items-center justify-center">
									<Github className="h-5 w-5 text-white" />
								</div>
								<div className="flex-1 min-w-0">
									<div className="font-medium text-sm">GitHub</div>
									<div className="text-xs text-muted-foreground">Loading...</div>
								</div>
							</div>
						) : githubInstallation ? (
							<div className="p-4 rounded-sm bg-secondary/30 border border-border/50 flex items-center gap-4">
								<div className="w-10 h-10 rounded-sm bg-[#24292e] flex items-center justify-center">
									<Github className="h-5 w-5 text-white" />
								</div>
								<div className="flex-1 min-w-0">
									<div className="font-medium text-sm">GitHub</div>
									<div className="text-xs text-muted-foreground">{githubInstallation.accountLogin} - Connected</div>
								</div>
								<div className="flex items-center gap-2">
									<span className="flex items-center gap-1 text-xs text-primary">
										<Check className="h-3.5 w-3.5" />
										Connected
									</span>
									<Button variant="ghost" size="sm" className="text-muted-foreground" disabled>
										Disconnect
									</Button>
								</div>
							</div>
						) : (
							<div className="p-4 rounded-sm bg-secondary/30 border border-border/50 border-dashed flex items-center gap-4">
								<div className="w-10 h-10 rounded-sm bg-[#24292e]/50 flex items-center justify-center">
									<Github className="h-5 w-5 text-white/50" />
								</div>
								<div className="flex-1 min-w-0">
									<div className="font-medium text-sm">GitHub</div>
									<div className="text-xs text-muted-foreground">Not connected</div>
								</div>
								<Button variant="outline" size="sm" asChild>
									<a href="/api/github/install">Connect</a>
								</Button>
							</div>
						)}

						{/* GitLab - Not connected (placeholder) */}
						<div className="p-4 rounded-sm bg-secondary/30 border border-border/50 border-dashed flex items-center gap-4">
							<div className="w-10 h-10 rounded-sm bg-[#FC6D26]/10 flex items-center justify-center">
								<svg className="h-5 w-5 text-[#FC6D26]" viewBox="0 0 24 24" fill="currentColor">
									<path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z"/>
								</svg>
							</div>
							<div className="flex-1 min-w-0">
								<div className="font-medium text-sm">GitLab</div>
								<div className="text-xs text-muted-foreground">Coming soon</div>
							</div>
							<Button variant="outline" size="sm" disabled>
								Connect
							</Button>
						</div>
					</div>
				</section>

				{/* ============================================ */}
				{/* REPOSITORIES SECTION */}
				{/* ============================================ */}
				<section>
					<div className="flex items-center gap-3 mb-6">
						<div className="w-9 h-9 rounded-sm bg-secondary/50 border border-border/50 flex items-center justify-center">
							<FolderGit2 className="h-4.5 w-4.5 text-muted-foreground" />
						</div>
						<div className="flex-1">
							<h2 className="font-medium">Monitored Repositories</h2>
							<p className="text-sm text-muted-foreground">Choose which repositories Memoria actively monitors</p>
						</div>
						<div className="text-sm text-muted-foreground">
							{Object.values(repoStatuses).filter(Boolean).length} / {repoLimit === -1 ? "∞" : repoLimit} active
						</div>
					</div>

					<div className="p-5 rounded-sm bg-secondary/30 border border-border/50">
						{/* Explanation */}
						<div className="mb-4 p-3 bg-primary/5 border border-primary/10 rounded-sm">
							<p className="text-sm text-muted-foreground">
								Active repositories receive real-time AI monitoring on pull requests.
								Inactive repos remain synced but won't receive automatic analysis.
							</p>
						</div>

						{/* Repository List */}
						<div className="space-y-2">
							{repositories.length === 0 ? (
								<div className="py-8 text-center">
									<FolderGit2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
									<div className="text-sm font-medium">No repositories connected</div>
									<div className="text-xs text-muted-foreground mt-1 mb-4">
										Connect your GitHub account to get started
									</div>
									<Button variant="outline" size="sm" asChild>
										<a href="/api/github/install">
											<Github className="h-4 w-4 mr-1.5" />
											Connect GitHub
										</a>
									</Button>
								</div>
							) : (
								<>
									{repositories.map((repo) => {
										const isActive = repoStatuses[repo._id] ?? repo.isActive;
										const isUpdating = updatingRepo === repo._id;
										const cannotActivate = !isActive && !canAddRepo;

										return (
											<div
												key={repo._id}
												className={`flex items-center gap-4 p-3 rounded-sm border transition-colors ${
													isActive
														? "bg-primary/5 border-primary/20"
														: "bg-background/50 border-border/50"
												}`}
											>
												<div className="w-8 h-8 rounded-sm bg-secondary/50 border border-border/50 flex items-center justify-center shrink-0">
													<Github className="h-4 w-4 text-muted-foreground" />
												</div>
												<div className="flex-1 min-w-0">
													<div className="flex items-center gap-2">
														<span className="font-medium text-sm truncate">{repo.fullName}</span>
														{repo.isPrivate && (
															<span className="px-1.5 py-0.5 text-[10px] bg-secondary/50 border border-border/50 rounded-sm text-muted-foreground">
																Private
															</span>
														)}
													</div>
													<div className="text-xs text-muted-foreground">
														{isActive ? (
															<span className="text-primary">Actively monitored</span>
														) : (
															"Not monitored"
														)}
													</div>
												</div>
												<div className="flex items-center gap-3">
													{isUpdating || isRefreshing ? (
														<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
													) : (
														<Switch
															checked={isActive}
															onCheckedChange={() => handleToggleRepo(repo._id, isActive, repo.fullName)}
															disabled={cannotActivate || isRefreshing}
															aria-label={`Toggle monitoring for ${repo.fullName}`}
														/>
													)}
												</div>
											</div>
										);
									})}

									{/* Limit Warning */}
									{!canAddRepo && (
										<div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/20 rounded-sm">
											<div className="flex items-center gap-2 text-sm">
												<Zap className="h-4 w-4 text-orange-500" />
												<span className="text-orange-600 font-medium">Repository limit reached</span>
											</div>
											<p className="text-xs text-muted-foreground mt-1">
												Upgrade your plan to monitor more repositories.{" "}
												<a href="/pricing" className="text-primary hover:underline">View plans</a>
											</p>
										</div>
									)}

									{/* Add More Repos Button */}
									{githubInstallation && canAddRepo && (
										<div className="mt-4 pt-4 border-t border-border/50">
											<Button variant="outline" size="sm" asChild>
												<a href={`https://github.com/apps/memoria-dev/installations/${githubInstallation.providerInstallationId}`} target="_blank" rel="noopener noreferrer">
													<Plus className="h-4 w-4 mr-1.5" />
													Add More Repositories
													<ExternalLink className="h-3 w-3 ml-1.5 opacity-50" />
												</a>
											</Button>
											<p className="text-xs text-muted-foreground mt-2">
												Manage repository access in GitHub to add more repos
											</p>
										</div>
									)}
								</>
							)}
						</div>
					</div>
				</section>

				{/* ============================================ */}
				{/* BILLING SECTION */}
				{/* ============================================ */}
				<section>
					<div className="flex items-center gap-3 mb-6">
						<div className="w-9 h-9 rounded-sm bg-secondary/50 border border-border/50 flex items-center justify-center">
							<CreditCard className="h-4.5 w-4.5 text-muted-foreground" />
						</div>
						<div>
							<h2 className="font-medium">Billing & Plan</h2>
							<p className="text-sm text-muted-foreground">Manage your subscription and payment</p>
						</div>
					</div>

					{/* Current Plan Card */}
					<div className="p-5 rounded-sm bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 mb-4">
						<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
							<div>
								<div className="flex items-center gap-2">
									<span className="text-xs font-semibold text-primary uppercase tracking-wider">{planName} Plan</span>
									<span className="px-1.5 py-0.5 text-[10px] font-medium bg-primary/20 text-primary rounded-sm">CURRENT</span>
									{billingStatus?.isTrialing && (
										<span className="px-1.5 py-0.5 text-[10px] font-medium bg-yellow-500/20 text-yellow-600 rounded-sm">
											TRIAL - {billingStatus.trialDaysRemaining} days left
										</span>
									)}
								</div>
								<div className="text-3xl font-bold mt-2">
									${planPrice}
									<span className="text-base font-normal text-muted-foreground">/month</span>
								</div>
								{billingStatus?.subscription?.currentPeriodEnd && (
									<div className="text-sm text-muted-foreground mt-1">
										Renews on {new Date(billingStatus.subscription.currentPeriodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
									</div>
								)}
							</div>
							<div className="flex flex-col gap-2">
								<Button size="sm" asChild>
									<a href="/pricing">
										<Zap className="h-4 w-4 mr-1.5" />
										Upgrade Plan
									</a>
								</Button>
								<Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
									<a href="/pricing">View All Plans</a>
								</Button>
							</div>
						</div>
					</div>

					{/* Usage Stats */}
					<div className="p-5 rounded-sm bg-secondary/30 border border-border/50 space-y-5">
						<div className="text-sm font-medium">Usage This Month</div>

						<div className="grid gap-4 sm:grid-cols-2">
							{/* Repositories */}
							<div className="space-y-2">
								<div className="flex items-center justify-between text-sm">
									<span className="text-muted-foreground">Repositories</span>
									<span className="font-medium">
										{activeRepos.length} / {repoLimit === -1 ? "Unlimited" : repoLimit}
									</span>
								</div>
								<div className="h-2 rounded-sm bg-secondary/50 border border-border/50 overflow-hidden">
									<div
										className={`h-full rounded-sm transition-all ${isRepoLimitReached ? "bg-orange-500" : "bg-primary"}`}
										style={{ width: `${repoUsagePercent}%` }}
									/>
								</div>
								{isRepoLimitReached ? (
									<div className="text-xs text-orange-500">Limit reached</div>
								) : repoLimit === -1 ? (
									<div className="text-xs text-muted-foreground">Unlimited</div>
								) : (
									<div className="text-xs text-muted-foreground">{repoLimit - activeRepos.length} remaining</div>
								)}
							</div>

							{/* Analyses */}
							<div className="space-y-2">
								<div className="flex items-center justify-between text-sm">
									<span className="text-muted-foreground">PR Analyses</span>
									<span className="font-medium">
										{billingStatus?.activeReposCount ?? 0} / {billingStatus?.plan?.maxAnalysesPerMonth === -1 ? "Unlimited" : (billingStatus?.plan?.maxAnalysesPerMonth ?? 50)}
									</span>
								</div>
								<div className="h-2 rounded-sm bg-secondary/50 border border-border/50 overflow-hidden">
									<div
										className="h-full bg-primary rounded-sm transition-all"
										style={{
											width: billingStatus?.plan?.maxAnalysesPerMonth === -1
												? "0%"
												: `${Math.min(100, ((billingStatus?.activeReposCount ?? 0) / (billingStatus?.plan?.maxAnalysesPerMonth ?? 50)) * 100)}%`
										}}
									/>
								</div>
								<div className="text-xs text-muted-foreground">
									{billingStatus?.plan?.maxAnalysesPerMonth === -1
										? "Unlimited"
										: `${(billingStatus?.plan?.maxAnalysesPerMonth ?? 50) - (billingStatus?.activeReposCount ?? 0)} remaining`}
								</div>
							</div>
						</div>

						<div className="h-px bg-border/50" />

						{/* Payment Method */}
						<div>
							<div className="text-sm font-medium mb-3">Payment Method</div>
							{billingStatus?.stripeCustomerId ? (
								<div className="flex items-center justify-between p-3 bg-background/50 border border-border/50 rounded-sm">
									<div className="flex items-center gap-3">
										<div className="w-10 h-7 rounded bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
											<CreditCard className="h-4 w-4 text-white" />
										</div>
										<div>
											<div className="text-sm font-medium">Card on file</div>
											<div className="text-xs text-muted-foreground">Managed via Stripe</div>
										</div>
									</div>
									<Button variant="ghost" size="sm" disabled>Update</Button>
								</div>
							) : (
								<div className="flex items-center justify-between p-3 bg-background/50 border border-border/50 border-dashed rounded-sm">
									<div className="text-sm text-muted-foreground">No payment method on file</div>
									<Button variant="outline" size="sm" disabled>Add Payment</Button>
								</div>
							)}
						</div>
					</div>
				</section>

				{/* ============================================ */}
				{/* NOTIFICATIONS SECTION */}
				{/* ============================================ */}
				<section>
					<div className="flex items-center gap-3 mb-6">
						<div className="w-9 h-9 rounded-sm bg-secondary/50 border border-border/50 flex items-center justify-center">
							<Bell className="h-4.5 w-4.5 text-muted-foreground" />
						</div>
						<div>
							<h2 className="font-medium">Notifications</h2>
							<p className="text-sm text-muted-foreground">Choose how you want to be notified</p>
						</div>
					</div>

					<div className="p-5 rounded-sm bg-secondary/30 border border-border/50 space-y-1">
						{/* Email Notifications */}
						<div className="flex items-center justify-between py-3">
							<div className="flex items-center gap-3">
								<Mail className="h-4 w-4 text-muted-foreground" />
								<div>
									<div className="text-sm font-medium">Email Notifications</div>
									<div className="text-xs text-muted-foreground">
										Critical alerts and issue warnings
									</div>
								</div>
							</div>
							<Switch defaultChecked disabled />
						</div>

						<div className="h-px bg-border/50" />

						{/* PR Comments */}
						<div className="flex items-center justify-between py-3">
							<div className="flex items-center gap-3">
								<Github className="h-4 w-4 text-muted-foreground" />
								<div>
									<div className="text-sm font-medium">PR Comments</div>
									<div className="text-xs text-muted-foreground">
										Post analysis results directly on pull requests
									</div>
								</div>
							</div>
							<Switch defaultChecked disabled />
						</div>

						<div className="h-px bg-border/50" />

						{/* Weekly Digest */}
						<div className="flex items-center justify-between py-3">
							<div className="flex items-center gap-3">
								<Zap className="h-4 w-4 text-muted-foreground" />
								<div>
									<div className="text-sm font-medium">Weekly Digest</div>
									<div className="text-xs text-muted-foreground">
										Summary of all analyses and insights
									</div>
								</div>
							</div>
							<Switch disabled />
						</div>

						<div className="h-px bg-border/50" />

						{/* Marketing */}
						<div className="flex items-center justify-between py-3">
							<div className="flex items-center gap-3">
								<Bell className="h-4 w-4 text-muted-foreground" />
								<div>
									<div className="text-sm font-medium">Product Updates</div>
									<div className="text-xs text-muted-foreground">
										New features and announcements
									</div>
								</div>
							</div>
							<Switch disabled />
						</div>
					</div>
				</section>

				{/* ============================================ */}
				{/* SECURITY SECTION */}
				{/* ============================================ */}
				<section>
					<div className="flex items-center gap-3 mb-6">
						<div className="w-9 h-9 rounded-sm bg-secondary/50 border border-border/50 flex items-center justify-center">
							<Shield className="h-4.5 w-4.5 text-muted-foreground" />
						</div>
						<div>
							<h2 className="font-medium">Security</h2>
							<p className="text-sm text-muted-foreground">Keep your account secure</p>
						</div>
					</div>

					<div className="p-5 rounded-sm bg-secondary/30 border border-border/50 space-y-1">
						{/* OAuth Info */}
						<div className="flex items-center justify-between py-3">
							<div className="flex items-center gap-3">
								<Lock className="h-4 w-4 text-muted-foreground" />
								<div>
									<div className="text-sm font-medium">Authentication</div>
									<div className="text-xs text-muted-foreground">
										Signed in via GitHub OAuth
									</div>
								</div>
							</div>
							<span className="text-xs text-muted-foreground">OAuth</span>
						</div>

						<div className="h-px bg-border/50" />

						{/* 2FA */}
						<div className="flex items-center justify-between py-3">
							<div className="flex items-center gap-3">
								<Smartphone className="h-4 w-4 text-muted-foreground" />
								<div>
									<div className="text-sm font-medium">Two-Factor Authentication</div>
									<div className="text-xs text-muted-foreground">
										Managed by your GitHub account
									</div>
								</div>
							</div>
							<Button variant="outline" size="sm" disabled>
								Via GitHub
							</Button>
						</div>

						<div className="h-px bg-border/50" />

						{/* Sessions */}
						<div className="flex items-center justify-between py-3">
							<div className="flex items-center gap-3">
								<RefreshCw className="h-4 w-4 text-muted-foreground" />
								<div>
									<div className="text-sm font-medium">Active Sessions</div>
									<div className="text-xs text-muted-foreground">
										1 device currently signed in
									</div>
								</div>
							</div>
							<Button variant="ghost" size="sm" className="text-muted-foreground" disabled>
								Manage
								<ChevronRight className="h-4 w-4 ml-1" />
							</Button>
						</div>
					</div>
				</section>

				{/* ============================================ */}
				{/* MCP CONFIGURATION SECTION */}
				{/* ============================================ */}
				<section>
					<div className="flex items-center gap-3 mb-6">
						<div className="w-9 h-9 rounded-sm bg-secondary/50 border border-border/50 flex items-center justify-center">
							<Key className="h-4.5 w-4.5 text-muted-foreground" />
						</div>
						<div>
							<h2 className="font-medium">MCP Configuration</h2>
							<p className="text-sm text-muted-foreground">Connect your local AI tools to team guardrails and memories</p>
						</div>
					</div>

					<div className="p-5 rounded-sm bg-secondary/30 border border-border/50 space-y-6">
						{/* Explanation */}
						<div className="p-3 bg-primary/5 border border-primary/10 rounded-sm">
							<p className="text-sm text-muted-foreground">
								Team tokens allow your local MCP server to sync guardrails and memories from your account.
								Add the token to your <code className="px-1 py-0.5 bg-secondary/50 rounded text-xs font-mono">.memoria.json</code> config file.
							</p>
						</div>

						{/* New Token Created Alert */}
						{showNewToken && (
							<div className="p-4 bg-primary/10 border border-primary/30 rounded-sm">
								<div className="flex items-center justify-between gap-2 mb-2">
									<div className="text-sm font-medium text-primary">New Token Created</div>
									<Button
										variant="ghost"
										size="sm"
										className="h-6 text-xs"
										onClick={() => setShowNewToken(null)}
									>
										Dismiss
									</Button>
								</div>
								<p className="text-xs text-muted-foreground mb-3">
									Copy this token now. You won't be able to see it again.
								</p>
								<div className="flex items-center gap-2">
									<Input
										ref={newTokenRef}
										value={showNewToken}
										readOnly
										className="font-mono text-sm bg-background"
										onClick={() => newTokenRef.current?.select()}
									/>
									<Button
										variant="outline"
										size="sm"
										onClick={() => handleCopyToken(showNewToken)}
									>
										<Copy className="h-4 w-4" />
									</Button>
								</div>
								<div className="mt-3 p-2 bg-background/50 border border-border/50 rounded-sm">
									<p className="text-xs text-muted-foreground mb-1">Add to your <code className="font-mono">.memoria.json</code>:</p>
									<pre className="text-xs font-mono text-foreground overflow-x-auto">
{`{
  "teamToken": "${showNewToken}"
}`}
									</pre>
								</div>
							</div>
						)}

						{/* Create New Token */}
						<div>
							<Label htmlFor="tokenName" className="text-sm text-muted-foreground mb-2 block">Create New Token</Label>
							<div className="flex items-center gap-2">
								<Input
									id="tokenName"
									value={newTokenName}
									onChange={(e) => setNewTokenName(e.target.value)}
									placeholder="Token name (e.g., 'MacBook Pro', 'Team CI')"
									className="flex-1"
									onKeyDown={(e) => e.key === "Enter" && handleCreateToken()}
								/>
								<Button
									onClick={handleCreateToken}
									disabled={creatingToken || !newTokenName.trim()}
									size="sm"
								>
									{creatingToken ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<>
											<Plus className="h-4 w-4 mr-1" />
											Create
										</>
									)}
								</Button>
							</div>
						</div>

						<div className="h-px bg-border/50" />

						{/* Existing Tokens */}
						<div>
							<div className="text-sm font-medium mb-3">Active Tokens</div>
							{loadingTokens ? (
								<div className="flex items-center justify-center py-4">
									<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
								</div>
							) : teamTokens.length === 0 ? (
								<div className="p-4 bg-background/50 border border-border/50 border-dashed rounded-sm text-center">
									<Key className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
									<div className="text-sm text-muted-foreground">No tokens created yet</div>
									<div className="text-xs text-muted-foreground mt-1">
										Create a token to connect your local MCP server
									</div>
								</div>
							) : (
								<div className="space-y-2">
									{teamTokens.map((token) => (
										<div
											key={token._id}
											className="flex items-center gap-4 p-3 bg-background/50 border border-border/50 rounded-sm"
										>
											<div className="w-8 h-8 rounded-sm bg-secondary/50 border border-border/50 flex items-center justify-center shrink-0">
												<Key className="h-4 w-4 text-muted-foreground" />
											</div>
											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-2">
													<span className="font-medium text-sm">{token.name}</span>
												</div>
												<div className="text-xs text-muted-foreground">
													Created {new Date(token.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
													{token.lastUsedAt && (
														<> · Last used {new Date(token.lastUsedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</>
													)}
													{!token.lastUsedAt && <> · Never used</>}
												</div>
											</div>
											<div className="flex items-center gap-2">
												<code className="px-2 py-1 text-xs font-mono bg-secondary/50 border border-border/50 rounded-sm">
													{token.maskedToken}
												</code>
												<Button
													variant="ghost"
													size="sm"
													className="text-destructive hover:text-destructive hover:bg-destructive/10"
													onClick={() => handleRevokeToken(token._id, token.name)}
													disabled={revokingTokenId === token._id}
												>
													{revokingTokenId === token._id ? (
														<Loader2 className="h-4 w-4 animate-spin" />
													) : (
														<Trash2 className="h-4 w-4" />
													)}
												</Button>
											</div>
										</div>
									))}
								</div>
							)}
						</div>

						<div className="h-px bg-border/50" />

						{/* Configuration Instructions */}
						<div>
							<div className="text-sm font-medium mb-3">Setup Instructions</div>
							<div className="space-y-3 text-xs text-muted-foreground">
								<div className="flex gap-2">
									<span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 text-[10px] font-medium">1</span>
									<span>Create a token above and copy it securely</span>
								</div>
								<div className="flex gap-2">
									<span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 text-[10px] font-medium">2</span>
									<span>Add the token to your project's <code className="px-1 py-0.5 bg-secondary/50 rounded font-mono">.memoria.json</code> file</span>
								</div>
								<div className="flex gap-2">
									<span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 text-[10px] font-medium">3</span>
									<span>Restart your AI tool (Cursor, Claude Code, etc.) to sync guardrails</span>
								</div>
							</div>
							<div className="mt-3 p-3 bg-background/50 border border-border/50 rounded-sm">
								<p className="text-xs text-muted-foreground mb-2">Example <code className="font-mono">.memoria.json</code>:</p>
								<pre className="text-xs font-mono text-foreground overflow-x-auto whitespace-pre">
{`{
  "teamToken": "mem_xxxxxxxxxxxxxxxxxxxxxxxx",
  "thresholds": {
    "couplingPercent": 15,
    "driftDays": 7
  }
}`}
								</pre>
							</div>
						</div>

						{/* Documentation Link */}
						<div className="text-center pt-2">
							<a
								href="https://github.com/byronwade/memoria#configuration"
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
							>
								View Full Documentation
								<ExternalLink className="h-3 w-3" />
							</a>
						</div>
					</div>
				</section>

				{/* ============================================ */}
				{/* DANGER ZONE */}
				{/* ============================================ */}
				<section>
					<div className="flex items-center gap-3 mb-6">
						<div className="w-9 h-9 rounded-sm bg-destructive/10 border border-destructive/20 flex items-center justify-center">
							<Trash2 className="h-4.5 w-4.5 text-destructive" />
						</div>
						<div>
							<h2 className="font-medium text-destructive">Danger Zone</h2>
							<p className="text-sm text-muted-foreground">Irreversible actions</p>
						</div>
					</div>

					<div className="p-5 rounded-sm bg-destructive/5 border border-destructive/20 space-y-4">
						<div className="flex items-center justify-between">
							<div>
								<div className="text-sm font-medium">Delete Account</div>
								<div className="text-xs text-muted-foreground">
									Permanently delete your account and all data
								</div>
							</div>
							<Button variant="destructive" size="sm" disabled>
								Delete Account
							</Button>
						</div>
					</div>
				</section>

			</div>
		</div>
	);
}
