"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
	Brain,
	Check,
	ChevronDown,
	ChevronsUpDown,
	ExternalLink,
	GitBranch,
	Github,
	LogOut,
	Moon,
	Plus,
	RefreshCw,
	Settings,
	Shield,
	Sun,
	X,
	CreditCard,
	Crown,
} from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useDashboard } from "./dashboard-context";
import { UpgradeModal } from "@/components/billing/upgrade-modal";

// Desktop header buttons (visible on md+)
const headerNavItems = [
	{ href: "/dashboard/guardrails", label: "Guardrails", icon: Shield },
	{ href: "/dashboard/memories", label: "Memories", icon: Brain },
];

// All nav items for dropdown (mobile shows all, desktop shows settings only)
const dropdownNavItems = [
	{ href: "/dashboard/guardrails", label: "Guardrails", icon: Shield, mobileOnly: true },
	{ href: "/dashboard/memories", label: "Memories", icon: Brain, mobileOnly: true },
	{ href: "/dashboard/settings", label: "Settings", icon: Settings, mobileOnly: false },
];

type DateRange = "today" | "7days" | "30days" | "90days";
type RiskFilter = "all" | "critical" | "high" | "medium" | "low";
type SyncStatus = "idle" | "syncing" | "success" | "error";

export function DashboardShell({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
	const router = useRouter();
	const {
		user,
		activeRepos,
		billingStatus,
		canAddRepo,
		repoLimit,
		logout,
	} = useDashboard();

	const [dateRange, setDateRange] = useState<DateRange>("30days");
	const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
	const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
	const [showUpgradeModal, setShowUpgradeModal] = useState(false);

	// Theme
	const { theme, setTheme, resolvedTheme } = useTheme();
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);

	const handleSync = useCallback(async () => {
		if (syncStatus === "syncing") return;

		// Get current repo from pathname
		const repoName = pathname.split("/dashboard/repositories/")[1]?.split("/")[0];
		const currentRepo = activeRepos.find(r => r.fullName.split("/")[1] === repoName);

		if (!currentRepo) {
			toast.error("No repository selected", {
				description: "Please select a repository to sync.",
			});
			setSyncStatus("error");
			setTimeout(() => setSyncStatus("idle"), 2000);
			return;
		}

		setSyncStatus("syncing");
		toast.loading("Syncing repository...", { id: "sync" });

		try {
			const response = await fetch(`/api/repositories/${currentRepo._id}/sync`, {
				method: "POST",
			});

			if (response.ok) {
				setSyncStatus("success");
				toast.success("Repository synced", {
					id: "sync",
					description: `${currentRepo.fullName} is now up to date.`,
				});
				// Refresh to show updated data
				router.refresh();
			} else {
				setSyncStatus("error");
				toast.error("Sync failed", {
					id: "sync",
					description: "Could not sync repository. Please try again.",
				});
			}
		} catch (error) {
			console.error("Sync failed:", error);
			setSyncStatus("error");
			toast.error("Sync failed", {
				id: "sync",
				description: "Network error. Please check your connection.",
			});
		} finally {
			setTimeout(() => setSyncStatus("idle"), 2000);
		}
	}, [syncStatus, pathname, activeRepos, router]);

	const handleAddRepo = () => {
		if (!canAddRepo) {
			setShowUpgradeModal(true);
		} else {
			router.push("/onboarding");
		}
	};

	return (
		<div className="min-h-screen bg-background">
			<header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-sm">
				<div className="flex h-14 items-center justify-between px-4 md:px-6">
					{/* Left: Logo + Org Switcher */}
					<div className="flex items-center gap-2 sm:gap-3">
						<Link href="/dashboard" className="flex items-center shrink-0">
							<img
								src="/memoria.svg"
								alt="Memoria"
								className="h-6 w-6 sm:h-7 sm:w-7 dark:invert"
							/>
						</Link>

						<span className="hidden sm:inline text-muted-foreground/30">/</span>

						{/* Repository Switcher */}
						<div className="flex items-center">
							<div className="flex items-center rounded-sm border border-border/50 overflow-hidden">
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<button
											className="flex items-center gap-1.5 sm:gap-2 px-2 sm:pl-2.5 sm:pr-2 h-8 text-sm font-medium bg-secondary/50 hover:bg-secondary transition-colors"
											aria-label={`Select repository. ${activeRepos.length} repositories connected`}
										>
											<GitBranch className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
											<span className="hidden sm:inline">Repositories</span>
											<span className="px-1.5 py-0.5 text-xs bg-background/80 rounded-sm tabular-nums" aria-hidden="true">
												{activeRepos.length}
											</span>
											<ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
										</button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="start" className="w-[calc(100vw-2rem)] sm:w-80 max-w-80">
										<DropdownMenuItem
											className="flex items-center gap-2 py-2.5 text-primary font-medium"
											onClick={handleAddRepo}
										>
											<Plus className="h-4 w-4" />
											<span>Add Repository</span>
											{!canAddRepo && (
												<Crown className="h-3.5 w-3.5 ml-auto text-yellow-500" />
											)}
										</DropdownMenuItem>
										<DropdownMenuSeparator />
										<div className="px-2.5 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
											Connected Repositories ({activeRepos.length}/{repoLimit === -1 ? "∞" : repoLimit})
										</div>
										{activeRepos.length === 0 ? (
											<div className="px-2.5 py-4 text-sm text-muted-foreground text-center">
												No repositories connected
											</div>
										) : (
											activeRepos.map((repo) => (
												<DropdownMenuItem
													key={repo._id}
													asChild
													className="flex items-center gap-3 py-2.5 px-2.5"
												>
													<Link href={`/dashboard/repositories/${repo.fullName.split("/")[1]}`}>
														<div className="w-9 h-9 rounded-sm bg-secondary flex items-center justify-center shrink-0">
															<GitBranch className="h-4 w-4 text-secondary-foreground/70" />
														</div>
														<div className="flex-1 min-w-0">
															<div className="flex items-center gap-2">
																<span className="font-medium text-sm text-foreground">
																	{repo.fullName.split("/")[1]}
																</span>
																{repo.isPrivate && (
																	<span className="text-[10px] px-1.5 py-0.5 bg-secondary rounded-sm text-secondary-foreground/70 font-medium">
																		Private
																	</span>
																)}
															</div>
															<div className="text-xs text-muted-foreground truncate">
																{repo.fullName}
															</div>
														</div>
													</Link>
												</DropdownMenuItem>
											))
										)}
										<DropdownMenuSeparator />
										<DropdownMenuItem asChild className="flex items-center gap-2">
											<a
												href="https://github.com/settings/installations"
												target="_blank"
												rel="noopener noreferrer"
											>
												<ExternalLink className="h-4 w-4 text-muted-foreground" />
												<span className="text-muted-foreground">Manage on GitHub</span>
											</a>
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>

								<button
									className={cn(
										"h-8 w-8 flex items-center justify-center transition-colors border-l",
										canAddRepo
											? "bg-primary text-primary-foreground hover:bg-primary/90 border-primary/20"
											: "bg-muted text-muted-foreground cursor-not-allowed border-border"
									)}
									onClick={handleAddRepo}
									aria-label={canAddRepo ? "Add repository" : "Upgrade to add more repositories"}
									title={canAddRepo ? "Add repository" : "Upgrade to add more repositories"}
								>
									<Plus className="h-4 w-4" />
								</button>
							</div>
						</div>
					</div>

					{/* Right: Nav + User Menu */}
					<div className="flex items-center gap-1 sm:gap-2">
						{/* Trial/Plan Badge */}
						{billingStatus?.isTrialing && (
							<div className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-sm bg-yellow-500/10 text-yellow-600 text-xs font-medium">
								<Crown className="h-3.5 w-3.5" />
								Trial: {billingStatus.trialDaysRemaining} days left
							</div>
						)}

						{/* Desktop Nav Buttons */}
						{headerNavItems.map((item) => {
							const isActive = pathname === item.href || pathname.startsWith(item.href);
							return (
								<Button
									key={item.href}
									variant="ghost"
									size="sm"
									asChild
									className={cn(
										"hidden md:flex items-center gap-1.5 h-8 px-2.5",
										isActive && "bg-secondary"
									)}
								>
									<Link href={item.href}>
										<item.icon className="h-4 w-4" />
										<span>{item.label}</span>
									</Link>
								</Button>
							);
						})}

						{/* User Dropdown */}
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									className="flex items-center gap-2 px-1.5 sm:px-2 h-8 text-sm font-medium"
								>
									{user.avatarUrl ? (
										<img
											src={user.avatarUrl}
											alt=""
											className="h-6 w-6 rounded-sm"
										/>
									) : (
										<div className="h-6 w-6 rounded-sm bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
											{user.name?.[0] || (user.email && user.email.length > 0 ? user.email[0].toUpperCase() : "?")}
										</div>
									)}
									<span className="hidden sm:inline">{user.name || (user.email ? user.email.split("@")[0] : "User")}</span>
									<ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-56">
								{/* User Info */}
								<div className="px-2.5 py-2.5 border-b border-border/50">
									<div className="flex items-center gap-3">
										{user.avatarUrl ? (
											<img
												src={user.avatarUrl}
												alt=""
												className="h-9 w-9 rounded-sm"
											/>
										) : (
											<div className="h-9 w-9 rounded-sm bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
												{user.name?.[0] || (user.email && user.email.length > 0 ? user.email[0].toUpperCase() : "?")}
											</div>
										)}
										<div className="flex-1 min-w-0">
											<div className="font-medium text-sm">{user.name || (user.email ? user.email.split("@")[0] : "User")}</div>
											<div className="text-xs text-muted-foreground truncate">{user.email || "No email"}</div>
										</div>
									</div>
									{billingStatus?.plan && (
										<div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
											<Crown className="h-3 w-3" />
											{billingStatus.plan.name} Plan
										</div>
									)}
								</div>

								{/* Navigation - Mobile shows all, desktop shows only non-header items */}
								<div className="py-1">
									{dropdownNavItems.map((item) => {
										const isActive =
											pathname === item.href ||
											(item.href !== "/dashboard" && pathname.startsWith(item.href));
										return (
											<DropdownMenuItem
												key={item.href}
												asChild
												className={cn(
													"flex items-center gap-2.5 py-2",
													isActive && "bg-secondary",
													item.mobileOnly && "md:hidden"
												)}
											>
												<Link href={item.href}>
													<item.icon className="h-4 w-4 text-muted-foreground" />
													<span className="text-foreground">{item.label}</span>
													{isActive && (
														<Check className="h-4 w-4 text-primary ml-auto" />
													)}
												</Link>
											</DropdownMenuItem>
										);
									})}
									{billingStatus?.stripeCustomerId && (
										<DropdownMenuItem
											className="flex items-center gap-2.5 py-2"
											onClick={async () => {
												try {
													toast.loading("Opening billing portal...", { id: "billing" });
													const response = await fetch("/api/billing/portal", {
														method: "POST",
														headers: { "Content-Type": "application/json" },
														body: JSON.stringify({}),
													});
													if (!response.ok) {
														toast.error("Failed to open billing portal", {
															id: "billing",
															description: "Please try again later.",
														});
														return;
													}
													const data = await response.json();
													if (data.url) {
														toast.dismiss("billing");
														window.location.href = data.url;
													} else {
														toast.error("Failed to open billing portal", {
															id: "billing",
															description: "No portal URL returned.",
														});
													}
												} catch (error) {
													console.error("Failed to open billing portal:", error);
													toast.error("Failed to open billing portal", {
														id: "billing",
														description: "Network error. Please try again.",
													});
												}
											}}
										>
											<CreditCard className="h-4 w-4 text-muted-foreground" />
											<span className="text-foreground">Billing</span>
										</DropdownMenuItem>
									)}
								</div>

								<DropdownMenuSeparator />

								{/* Theme Toggle - Simple clickable row */}
								<DropdownMenuItem
									className="flex items-center justify-between py-2"
									onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
								>
									<div className="flex items-center gap-2.5">
										{mounted && resolvedTheme === "dark" ? (
											<Moon className="h-4 w-4 text-muted-foreground" />
										) : (
											<Sun className="h-4 w-4 text-muted-foreground" />
										)}
										<span className="text-foreground">Theme</span>
									</div>
									<span className="text-xs text-muted-foreground capitalize">
										{mounted ? resolvedTheme : "system"}
									</span>
								</DropdownMenuItem>

								<DropdownMenuSeparator />

								{/* Logout */}
								<DropdownMenuItem
									className="flex items-center gap-2.5 py-2 text-destructive focus:text-destructive"
									onClick={logout}
								>
									<LogOut className="h-4 w-4" />
									<span>Logout</span>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>

				{/* Toolbar - Only show on repository pages */}
				{pathname.startsWith("/dashboard/repositories/") && (() => {
					const repoName = pathname.split("/dashboard/repositories/")[1]?.split("/")[0];
					const currentRepo = activeRepos.find(r => r.fullName.split("/")[1] === repoName);

					const dateRangeLabels: Record<DateRange, string> = {
						today: "Today",
						"7days": "Last 7 days",
						"30days": "Last 30 days",
						"90days": "Last 90 days",
					};

					const riskFilterLabels: Record<RiskFilter, string> = {
						all: "All Risk Levels",
						critical: "Critical Only",
						high: "High & Critical",
						medium: "Medium & Above",
						low: "All Files",
					};

					return (
						<div className="w-full max-w-6xl mx-auto px-4 md:px-6 py-4">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<button className="flex items-center gap-2 h-8 px-3 text-sm font-medium rounded-sm cursor-pointer transition-all bg-secondary/50 hover:bg-secondary text-foreground border border-border/50 hover:border-border active:scale-[0.98]">
												{dateRangeLabels[dateRange]}
												<ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
											</button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="start" className="w-40">
											{(Object.entries(dateRangeLabels) as [DateRange, string][]).map(([value, label]) => (
												<DropdownMenuItem
													key={value}
													className="text-foreground flex items-center justify-between"
													onClick={() => setDateRange(value)}
												>
													{label}
													{dateRange === value && <Check className="h-3.5 w-3.5" />}
												</DropdownMenuItem>
											))}
										</DropdownMenuContent>
									</DropdownMenu>

									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<button className={cn(
												"flex items-center gap-2 h-8 px-3 text-sm font-medium rounded-sm cursor-pointer transition-all border active:scale-[0.98]",
												riskFilter !== "all"
													? "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
													: "bg-secondary/50 hover:bg-secondary text-foreground border-border/50 hover:border-border"
											)}>
												{riskFilter !== "all" && (
													<span className="w-2 h-2 rounded-full bg-primary" />
												)}
												{riskFilterLabels[riskFilter]}
												<ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
											</button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="start" className="w-44">
											{(Object.entries(riskFilterLabels) as [RiskFilter, string][]).map(([value, label]) => (
												<DropdownMenuItem
													key={value}
													className="text-foreground flex items-center justify-between"
													onClick={() => setRiskFilter(value)}
												>
													{label}
													{riskFilter === value && <Check className="h-3.5 w-3.5" />}
												</DropdownMenuItem>
											))}
										</DropdownMenuContent>
									</DropdownMenu>

									{(dateRange !== "30days" || riskFilter !== "all") && (
										<button
											onClick={() => {
												setDateRange("30days");
												setRiskFilter("all");
											}}
											aria-label="Clear all filters"
											className="flex items-center gap-1.5 h-8 px-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
										>
											<X className="h-3 w-3" aria-hidden="true" />
											Clear
										</button>
									)}
								</div>

								<div className="flex items-center gap-2">
									<button
										onClick={handleSync}
										disabled={syncStatus === "syncing"}
										aria-label={
											syncStatus === "syncing"
												? "Syncing repository data"
												: syncStatus === "success"
												? "Repository synced successfully"
												: syncStatus === "error"
												? "Sync failed, click to retry"
												: "Sync repository data"
										}
										className={cn(
											"flex items-center gap-2 h-8 px-3 text-sm font-medium rounded-sm cursor-pointer transition-all border active:scale-[0.98]",
											syncStatus === "syncing"
												? "bg-primary/10 text-primary border-primary/30"
												: syncStatus === "success"
												? "bg-green-500/10 text-green-600 border-green-500/30"
												: syncStatus === "error"
												? "bg-red-500/10 text-red-600 border-red-500/30"
												: "bg-secondary/50 hover:bg-secondary text-foreground border-border/50 hover:border-border"
										)}
									>
										<RefreshCw className={cn("h-3.5 w-3.5", syncStatus === "syncing" && "animate-spin")} aria-hidden="true" />
										<span className="hidden sm:inline">
											{syncStatus === "syncing" ? "Syncing..." : syncStatus === "success" ? "Synced" : syncStatus === "error" ? "Failed" : "Sync"}
										</span>
									</button>

									{currentRepo && (
										<a
											href={`https://github.com/${currentRepo.fullName}`}
											target="_blank"
											rel="noopener noreferrer"
											aria-label={`View ${currentRepo.fullName} on GitHub`}
											className="flex items-center gap-2 h-8 px-3 text-sm font-medium rounded-sm cursor-pointer transition-all bg-secondary/50 hover:bg-secondary text-foreground border border-border/50 hover:border-border active:scale-[0.98]"
										>
											<Github className="h-3.5 w-3.5" aria-hidden="true" />
											<span className="hidden sm:inline">GitHub</span>
										</a>
									)}
								</div>
							</div>
						</div>
					);
				})()}
			</header>

			<main className="min-h-[calc(100vh-3.5rem)]">
				{children}
			</main>

			{/* Upgrade Modal */}
			<UpgradeModal
				open={showUpgradeModal}
				onOpenChange={setShowUpgradeModal}
				currentPlan={billingStatus?.plan?.tier}
				reason="repo_limit"
			/>
		</div>
	);
}
