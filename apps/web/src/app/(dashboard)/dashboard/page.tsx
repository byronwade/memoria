import { redirect } from "next/navigation";
import {
	GitBranch,
	Plus,
	ArrowRight,
	Shield,
	ShieldAlert,
	ShieldCheck,
	Brain,
	Activity,
	AlertTriangle,
	CheckCircle2,
	ChevronRight,
	Zap,
} from "lucide-react";
import Link from "next/link";
import { getDashboardData } from "../dashboard-data";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
	const data = await getDashboardData();

	if (!data) {
		redirect("/login");
	}

	// If needs onboarding, redirect there
	if (data.needsOnboarding) {
		redirect("/onboarding");
	}

	// Get active repositories
	const activeRepos = data.repositories.filter((r) => r.isActive);

	// Calculate stats
	const guardrailStats = data.guardrailStats;
	const interventionStats = data.interventionStats;
	const memoriesCount = data.memories.length;

	// If no active repos, show empty state
	if (activeRepos.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
				<div className="w-20 h-20 rounded-sm bg-secondary/50 border border-dashed border-border/50 flex items-center justify-center mb-6">
					<GitBranch className="h-10 w-10 text-muted-foreground" />
				</div>
				<h1 className="text-2xl font-semibold mb-2">No repositories connected</h1>
				<p className="text-muted-foreground text-center max-w-md mb-8">
					Connect your first repository to start analyzing your codebase with Memoria.
				</p>
				<Button asChild size="lg">
					<Link href="/onboarding">
						<Plus className="h-5 w-5 mr-2" />
						Connect Repository
						<ArrowRight className="h-4 w-4 ml-2" />
					</Link>
				</Button>
			</div>
		);
	}

	return (
		<div className="pb-16">
			{/* Header */}
			<div className="max-w-6xl mx-auto px-4 md:px-6 pt-8">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-semibold tracking-tight">AI Control Plane</h1>
						<p className="text-muted-foreground mt-1">
							Monitor and manage how AI interacts with your codebase
						</p>
					</div>
					<Button asChild>
						<Link href="/dashboard/guardrails/new">
							<Plus className="h-4 w-4 mr-2" />
							Add Guardrail
						</Link>
					</Button>
				</div>
			</div>

			{/* Stats Grid */}
			<div className="max-w-6xl mx-auto px-4 md:px-6 mt-8">
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
					{/* Active Guardrails */}
					<div className="p-5 rounded-sm bg-secondary/30 border border-border/50">
						<div className="flex items-center gap-3 mb-3">
							<div className="w-10 h-10 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center">
								<Shield className="h-5 w-5 text-primary" />
							</div>
							<div className="text-sm text-muted-foreground">Active Guardrails</div>
						</div>
						<div className="text-3xl font-bold">{guardrailStats?.enabled ?? 0}</div>
						<div className="text-xs text-muted-foreground mt-1">
							{guardrailStats?.blocking ?? 0} blocking · {guardrailStats?.warning ?? 0} warning
						</div>
					</div>

					{/* AI Interventions */}
					<div className="p-5 rounded-sm bg-secondary/30 border border-border/50">
						<div className="flex items-center gap-3 mb-3">
							<div className="w-10 h-10 rounded-sm bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
								<ShieldAlert className="h-5 w-5 text-orange-500" />
							</div>
							<div className="text-sm text-muted-foreground">AI Interventions</div>
						</div>
						<div className="text-3xl font-bold">{interventionStats?.total ?? 0}</div>
						<div className="text-xs text-muted-foreground mt-1">
							{interventionStats?.blocked ?? 0} blocked · {interventionStats?.warned ?? 0} warned
						</div>
					</div>

					{/* Team Memories */}
					<div className="p-5 rounded-sm bg-secondary/30 border border-border/50">
						<div className="flex items-center gap-3 mb-3">
							<div className="w-10 h-10 rounded-sm bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
								<Brain className="h-5 w-5 text-blue-500" />
							</div>
							<div className="text-sm text-muted-foreground">Team Memories</div>
						</div>
						<div className="text-3xl font-bold">{memoriesCount}</div>
						<div className="text-xs text-muted-foreground mt-1">
							Context items for AI to consider
						</div>
					</div>

					{/* Last 7 Days Activity */}
					<div className="p-5 rounded-sm bg-secondary/30 border border-border/50">
						<div className="flex items-center gap-3 mb-3">
							<div className="w-10 h-10 rounded-sm bg-green-500/10 border border-green-500/20 flex items-center justify-center">
								<Activity className="h-5 w-5 text-green-500" />
							</div>
							<div className="text-sm text-muted-foreground">Last 7 Days</div>
						</div>
						<div className="text-3xl font-bold">{interventionStats?.last7Days ?? 0}</div>
						<div className="text-xs text-muted-foreground mt-1">
							Interventions this week
						</div>
					</div>
				</div>
			</div>

			{/* Two Column Layout */}
			<div className="max-w-6xl mx-auto px-4 md:px-6 mt-8 grid gap-6 lg:grid-cols-2">
				{/* Active Guardrails List */}
				<div className="p-5 rounded-sm bg-secondary/30 border border-border/50">
					<div className="flex items-center justify-between mb-4">
						<h2 className="font-medium">Active Guardrails</h2>
						<Link
							href="/dashboard/guardrails"
							className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
						>
							View All <ChevronRight className="h-3 w-3" />
						</Link>
					</div>
					{data.guardrails.filter((g) => g.isEnabled).length === 0 ? (
						<div className="py-8 text-center">
							<ShieldCheck className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
							<div className="text-sm text-muted-foreground">No guardrails configured</div>
							<Button variant="outline" size="sm" className="mt-3" asChild>
								<Link href="/dashboard/guardrails/new">
									<Plus className="h-4 w-4 mr-1" />
									Add First Guardrail
								</Link>
							</Button>
						</div>
					) : (
						<div className="space-y-2">
							{data.guardrails
								.filter((g) => g.isEnabled)
								.slice(0, 5)
								.map((guardrail) => (
									<div
										key={guardrail._id}
										className="flex items-center gap-3 p-3 bg-background/50 border border-border/50 rounded-sm"
									>
										<div
											className={`w-8 h-8 rounded-sm flex items-center justify-center shrink-0 ${
												guardrail.level === "block"
													? "bg-red-500/10 border border-red-500/20"
													: "bg-yellow-500/10 border border-yellow-500/20"
											}`}
										>
											{guardrail.level === "block" ? (
												<AlertTriangle className="h-4 w-4 text-red-500" />
											) : (
												<Zap className="h-4 w-4 text-yellow-500" />
											)}
										</div>
										<div className="flex-1 min-w-0">
											<code className="text-sm font-mono text-foreground truncate block">
												{guardrail.pattern}
											</code>
											<div className="text-xs text-muted-foreground truncate">
												{guardrail.message}
											</div>
										</div>
										<span
											className={`px-2 py-0.5 text-xs font-medium rounded-sm ${
												guardrail.level === "block"
													? "bg-red-500/10 text-red-500 border border-red-500/20"
													: "bg-yellow-500/10 text-yellow-600 border border-yellow-500/20"
											}`}
										>
											{guardrail.level}
										</span>
									</div>
								))}
						</div>
					)}
				</div>

				{/* Recent Activity */}
				<div className="p-5 rounded-sm bg-secondary/30 border border-border/50">
					<div className="flex items-center justify-between mb-4">
						<h2 className="font-medium">Recent Activity</h2>
						<Link
							href="/dashboard/activity"
							className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
						>
							View All <ChevronRight className="h-3 w-3" />
						</Link>
					</div>
					{(interventionStats?.total ?? 0) === 0 ? (
						<div className="py-8 text-center">
							<CheckCircle2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
							<div className="text-sm text-muted-foreground">No interventions yet</div>
							<div className="text-xs text-muted-foreground mt-1">
								AI activity will appear here when guardrails are triggered
							</div>
						</div>
					) : (
						<div className="space-y-3">
							{/* Intervention summary by tool */}
							{interventionStats?.byTool &&
								Object.entries(interventionStats.byTool)
									.slice(0, 5)
									.map(([tool, count]) => (
										<div
											key={tool}
											className="flex items-center justify-between p-3 bg-background/50 border border-border/50 rounded-sm"
										>
											<div className="flex items-center gap-3">
												<div className="w-8 h-8 rounded-sm bg-secondary/50 border border-border/50 flex items-center justify-center">
													<Activity className="h-4 w-4 text-muted-foreground" />
												</div>
												<div>
													<div className="text-sm font-medium capitalize">{tool}</div>
													<div className="text-xs text-muted-foreground">
														{count} intervention{count !== 1 ? "s" : ""}
													</div>
												</div>
											</div>
										</div>
									))}
						</div>
					)}
				</div>
			</div>

			{/* Repositories Overview */}
			<div className="max-w-6xl mx-auto px-4 md:px-6 mt-8">
				<div className="p-5 rounded-sm bg-secondary/30 border border-border/50">
					<div className="flex items-center justify-between mb-4">
						<h2 className="font-medium">Monitored Repositories</h2>
						<Link
							href="/dashboard/settings"
							className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
						>
							Manage <ChevronRight className="h-3 w-3" />
						</Link>
					</div>
					<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
						{activeRepos.slice(0, 6).map((repo) => (
							<Link
								key={repo._id}
								href={`/dashboard/repositories/${repo.fullName.split("/")[1]}`}
								className="flex items-center gap-3 p-3 bg-background/50 border border-border/50 rounded-sm hover:bg-background/80 transition-colors"
							>
								<div className="w-8 h-8 rounded-sm bg-secondary/50 border border-border/50 flex items-center justify-center shrink-0">
									<GitBranch className="h-4 w-4 text-muted-foreground" />
								</div>
								<div className="flex-1 min-w-0">
									<div className="text-sm font-medium truncate">{repo.fullName}</div>
									<div className="text-xs text-muted-foreground">
										{repo.isPrivate ? "Private" : "Public"}
									</div>
								</div>
								<ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
							</Link>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
