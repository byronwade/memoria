"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useParams } from "next/navigation";
import {
	AlertTriangle,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	Clock,
	FileCode,
	FolderOpen,
	GitBranch,
	GitCommit,
	Link2,
	RefreshCw,
	Shield,
	ShieldAlert,
	ShieldCheck,
	TrendingDown,
	TrendingUp,
	Users,
	Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { useDashboard } from "../../../dashboard-context";

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

interface ApiRepositoryStats {
	totalAnalyses: number;
	issuesPrevented: number;
	avgRiskScore: number;
	healthScore: number;
	trend: "up" | "down" | "stable";
	riskDistribution: {
		high: number;
		medium: number;
		low: number;
	};
	analysisBreakdown: {
		prAnalyses: number;
		fileAnalyses: number;
		couplingDetections: number;
	};
	// Comparison metrics (vs last period)
	issuesPreventedChange?: number;
	avgRiskScoreChange?: number;
	totalAnalysesChange?: number;
}

interface ApiRiskyFile {
	_id: string;
	filePath: string;
	riskScore: number;
	riskLevel: "high" | "medium" | "low";
	volatilityScore: number;
	coupledFilesCount: number;
	importersCount: number;
	lastAnalyzedAt: number;
}

interface ApiActivity {
	_id: string;
	type: "analysis" | "pr" | "coupling" | "drift";
	description: string;
	filePath?: string;
	riskLevel?: "high" | "medium" | "low";
	timestamp: number;
}

interface ApiCouplingPair {
	file1: string;
	file2: string;
	couplingScore: number;
	coChangeCount: number;
	relationship: string;
}

interface ApiChartDataPoint {
	date: string;
	analyses: number;
	prevented: number;
	avgRisk: number;
}

interface ApiContributor {
	name: string;
	avatar?: string;
	commits: number;
	filesOwned: number;
}

interface ApiResponse {
	stats: ApiRepositoryStats | null;
	riskyFiles: { files: ApiRiskyFile[]; total: number } | null;
	activity: { activities: ApiActivity[]; total: number } | null;
	coupling: { pairs: ApiCouplingPair[]; total: number } | null;
	chartData: ApiChartDataPoint[] | null;
	contributors: ApiContributor[] | null;
}

// Pagination constants
const ITEMS_PER_PAGE = 10;
const MAX_COUPLED_FILES_SHOWN = 5;

// ============================================================================
// LOADING & STATE TYPES
// ============================================================================

type SyncStatus = "idle" | "syncing" | "error" | "success";
type LoadingState = "loading" | "loaded" | "error";

// ============================================================================
// SKELETON COMPONENTS
// ============================================================================

function HealthScoreSkeleton() {
	return (
		<div className="flex items-center gap-6">
			<Skeleton className="w-24 h-24 rounded-full" />
			<div>
				<Skeleton className="h-6 w-40 mb-2" />
				<Skeleton className="h-4 w-56" />
			</div>
		</div>
	);
}

function QuickStatsSkeleton() {
	return (
		<div className="flex flex-wrap gap-8">
			{[1, 2, 3].map((i) => (
				<div key={i} className="p-3 -m-3">
					<Skeleton className="h-9 w-16 mb-2" />
					<Skeleton className="h-4 w-28" />
				</div>
			))}
		</div>
	);
}

function RiskDistributionSkeleton() {
	return (
		<div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
			<Skeleton className="flex-1 h-3 rounded-sm" />
			<div className="flex items-center gap-3 sm:gap-4">
				{[1, 2, 3, 4].map((i) => (
					<Skeleton key={i} className="h-5 w-16" />
				))}
			</div>
		</div>
	);
}

function ChartSkeleton() {
	return (
		<div className="mt-10 w-full">
			<div className="max-w-6xl mx-auto px-4 md:px-6 mb-3">
				<div className="flex items-center justify-between">
					<Skeleton className="h-4 w-24" />
					<div className="flex items-center gap-4">
						<Skeleton className="h-4 w-20" />
						<Skeleton className="h-4 w-20" />
					</div>
				</div>
			</div>
			<Skeleton className="h-56 md:h-72 w-full" />
		</div>
	);
}

function FileCardSkeleton() {
	return (
		<div className="p-4 rounded-sm border border-border/50 bg-secondary/30">
			<div className="flex items-start justify-between gap-4">
				<div className="flex items-start gap-3 flex-1">
					<Skeleton className="w-10 h-10 rounded-sm shrink-0" />
					<div className="flex-1">
						<Skeleton className="h-5 w-48 mb-2" />
						<Skeleton className="h-4 w-64 mb-3" />
						<div className="flex gap-4">
							<Skeleton className="h-3 w-20" />
							<Skeleton className="h-3 w-20" />
							<Skeleton className="h-3 w-20" />
						</div>
					</div>
				</div>
				<div className="text-right">
					<Skeleton className="h-8 w-12 mb-1" />
					<Skeleton className="h-3 w-16" />
				</div>
			</div>
			<div className="mt-4 pt-3 border-t border-border/50">
				<Skeleton className="h-3 w-20 mb-2" />
				<div className="flex gap-1.5">
					{[1, 2, 3].map((i) => (
						<Skeleton key={i} className="h-6 w-24" />
					))}
				</div>
			</div>
		</div>
	);
}

function ActivityItemSkeleton() {
	return (
		<div className="flex items-center gap-4 py-3 border-b border-border/50">
			<Skeleton className="w-8 h-8 rounded-sm shrink-0" />
			<div className="flex-1">
				<Skeleton className="h-4 w-48 mb-1" />
				<Skeleton className="h-3 w-32" />
			</div>
			<div className="flex items-center gap-3">
				<Skeleton className="h-5 w-10" />
				<Skeleton className="h-4 w-16" />
			</div>
		</div>
	);
}

function CouplingPairSkeleton() {
	return (
		<div className="p-4 rounded-sm border border-border/50 bg-secondary/30">
			<div className="flex items-center gap-3">
				<div className="flex-1">
					<Skeleton className="h-4 w-40" />
				</div>
				<Skeleton className="h-4 w-16" />
				<div className="flex-1 flex justify-end">
					<Skeleton className="h-4 w-40" />
				</div>
			</div>
			<div className="flex justify-end mt-3">
				<Skeleton className="h-3 w-32" />
			</div>
		</div>
	);
}

function ContributorsSkeleton() {
	return (
		<div className="flex flex-wrap gap-4">
			{[1, 2, 3].map((i) => (
				<div key={i} className="flex items-center gap-3 p-3 rounded-sm border border-border/50 bg-secondary/30">
					<Skeleton className="w-10 h-10 rounded-sm" />
					<div>
						<Skeleton className="h-4 w-24 mb-1" />
						<Skeleton className="h-3 w-32" />
					</div>
				</div>
			))}
		</div>
	);
}

// Full page skeleton
function PageSkeleton() {
	return (
		<div className="pt-2 pb-40 animate-in fade-in duration-300">
			{/* Header */}
			<div className="max-w-6xl mx-auto px-4 md:px-6 pt-6">
				<div className="flex items-center gap-4">
					<Skeleton className="w-12 h-12 rounded-sm" />
					<div>
						<Skeleton className="h-7 w-32 mb-2" />
						<Skeleton className="h-4 w-56" />
					</div>
				</div>
			</div>

			{/* Health Score + Stats */}
			<div className="max-w-6xl mx-auto px-4 md:px-6 pt-8">
				<div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
					<HealthScoreSkeleton />
					<QuickStatsSkeleton />
				</div>
			</div>

			{/* Risk Distribution */}
			<div className="max-w-6xl mx-auto px-4 md:px-6 mt-8">
				<RiskDistributionSkeleton />
			</div>

			{/* Chart */}
			<ChartSkeleton />

			{/* Tabs */}
			<div className="max-w-6xl mx-auto px-4 md:px-6 mt-10">
				<div className="flex gap-4 border-b border-border/50 pb-2">
					<Skeleton className="h-8 w-32" />
					<Skeleton className="h-8 w-32" />
					<Skeleton className="h-8 w-32" />
				</div>
			</div>

			{/* Tab Content */}
			<div className="max-w-6xl mx-auto px-4 md:px-6 mt-6 space-y-4">
				{[1, 2, 3].map((i) => (
					<FileCardSkeleton key={i} />
				))}
			</div>

			{/* Contributors */}
			<div className="max-w-6xl mx-auto px-4 md:px-6 mt-12">
				<Skeleton className="h-5 w-32 mb-5" />
				<ContributorsSkeleton />
			</div>
		</div>
	);
}

// ============================================================================
// EMPTY STATE COMPONENTS
// ============================================================================

function EmptyFilesState() {
	return (
		<Empty className="py-12 border border-border/50 rounded-sm bg-secondary/10">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<ShieldCheck className="h-6 w-6" />
				</EmptyMedia>
				<EmptyTitle>No high-risk files</EmptyTitle>
				<EmptyDescription>
					Great news! There are no files with elevated risk scores in this repository.
					All analyzed files are within safe thresholds.
				</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}

function EmptyActivityState() {
	return (
		<Empty className="py-12 border border-border/50 rounded-sm bg-secondary/10">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<Clock className="h-6 w-6" />
				</EmptyMedia>
				<EmptyTitle>No recent activity</EmptyTitle>
				<EmptyDescription>
					No file analyses have been performed yet. Activity will appear here
					as you use Memoria to analyze files in your workflow.
				</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}

function EmptyCouplingState() {
	return (
		<Empty className="py-12 border border-border/50 rounded-sm bg-secondary/10">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<Link2 className="h-6 w-6" />
				</EmptyMedia>
				<EmptyTitle>No file coupling detected</EmptyTitle>
				<EmptyDescription>
					No files with significant co-change patterns have been found.
					Coupling data builds up as your team makes commits over time.
				</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}

function EmptyRepositoryState({ repoName }: { repoName: string }) {
	return (
		<div className="max-w-6xl mx-auto px-4 md:px-6 py-24">
			<Empty className="py-16 border border-border/50 rounded-sm bg-secondary/10">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<FolderOpen className="h-6 w-6" />
					</EmptyMedia>
					<EmptyTitle>Repository not analyzed yet</EmptyTitle>
					<EmptyDescription>
						<strong>{repoName}</strong> hasn't been analyzed by Memoria yet.
						Run your first analysis to start tracking file risks and coupling.
					</EmptyDescription>
				</EmptyHeader>
				<Button variant="default" className="mt-4">
					<RefreshCw className="h-4 w-4 mr-2" />
					Start Analysis
				</Button>
			</Empty>
		</div>
	);
}

// ============================================================================
// SYNCING STATE COMPONENT
// ============================================================================

function SyncingBanner({ progress, filesAnalyzed, totalFiles }: { progress: number; filesAnalyzed: number; totalFiles: number }) {
	return (
		<div className="bg-primary/10 border-b border-primary/20">
			<div className="max-w-6xl mx-auto px-4 md:px-6 py-3">
				<div className="flex items-center justify-between gap-4">
					<div className="flex items-center gap-3">
						<RefreshCw className="h-4 w-4 text-primary animate-spin" />
						<span className="text-sm font-medium">Syncing repository...</span>
						<span className="text-sm text-muted-foreground">
							{filesAnalyzed.toLocaleString()} / {totalFiles.toLocaleString()} files
						</span>
					</div>
					<div className="flex items-center gap-3">
						<div className="w-32 h-2 bg-primary/20 rounded-full overflow-hidden">
							<div
								className="h-full bg-primary rounded-full transition-all duration-300"
								style={{ width: `${progress}%` }}
							/>
						</div>
						<span className="text-sm font-medium tabular-nums w-12 text-right">{Math.round(progress)}%</span>
					</div>
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// TYPES
// ============================================================================

interface RepoData {
	name: string;
	fullName: string;
	description: string;
	health: number;
	trend: "up" | "down" | "stable";
	lastSync: string;
	defaultBranch: string;
	isPrivate: boolean;
	stats: {
		totalFiles: number;
		analyzedFiles: number;
		totalAnalyses: number;
		issuesPrevented: number;
		avgRiskScore: number;
		criticalFiles: number;
		highRiskFiles: number;
		// Comparison metrics (vs last period)
		issuesPreventedChange?: number; // percentage change
		avgRiskScoreChange?: number;
		totalAnalysesChange?: number;
	};
	riskDistribution: {
		critical: number;
		high: number;
		medium: number;
		low: number;
	};
	topContributors: Array<{
		name: string;
		avatar: string | null;
		commits: number;
		filesOwned: number;
	}>;
	recentActivity: Array<{
		type: "analysis" | "prevented" | "safe";
		file: string;
		risk: number;
		time: string;
		result: string;
	}>;
	riskyFiles: Array<{
		file: string;
		risk: number;
		riskLevel: "critical" | "high" | "medium" | "low";
		reason: string;
		coupledFiles: string[];
		lastModified: string;
		modifiedBy: string;
		commits: number;
	}>;
	couplingPairs: Array<{
		primary: string;
		coupled: string;
		strength: number;
		coChanges: number;
	}>;
	weeklyTrend: Array<{
		day: string;
		analyses: number;
		prevented: number;
	}>;
	chartData: Array<{
		date: string;
		analyses: number;
		prevented: number;
		avgRisk: number;
	}>;
}

// ============================================================================
// DATA FETCHING - Uses real data from API
// ============================================================================

// Hook to fetch repository stats from API
function useRepositoryStats(repoId: string | undefined) {
	const [data, setData] = useState<ApiResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!repoId) {
			setLoading(false);
			return;
		}

		const fetchStats = async () => {
			try {
				setLoading(true);
				setError(null);
				const response = await fetch(`/api/repositories/${repoId}/stats?type=all`);
				if (!response.ok) {
					throw new Error("Failed to fetch repository stats");
				}
				const result = await response.json();
				setData(result);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Unknown error");
			} finally {
				setLoading(false);
			}
		};

		fetchStats();
	}, [repoId]);

	return { data, loading, error };
}

// Fetch paginated data for tabs
async function fetchPaginatedData(
	repoId: string,
	type: "riskyFiles" | "activity" | "coupling",
	limit: number,
	offset: number
): Promise<{
	riskyFiles?: { files: ApiRiskyFile[]; total: number };
	activity?: { activities: ApiActivity[]; total: number };
	coupling?: { pairs: ApiCouplingPair[]; total: number };
}> {
	const response = await fetch(
		`/api/repositories/${repoId}/stats?type=${type}&limit=${limit}&offset=${offset}`
	);
	if (!response.ok) {
		throw new Error("Failed to fetch data");
	}
	return response.json();
}

// Build repo data from real API response
const buildRepoDataFromApi = (
	contextRepo: { _id: string; fullName: string; isPrivate: boolean; lastAnalyzedAt: number | null },
	apiData: ApiResponse | null
): RepoData => {
	const [owner, repoName] = contextRepo.fullName.split('/');

	const lastSyncText = contextRepo.lastAnalyzedAt
		? formatTimeAgo(contextRepo.lastAnalyzedAt)
		: "Never";

	// Use API data if available, otherwise use empty defaults
	const stats = apiData?.stats;
	const riskDistribution = stats?.riskDistribution || { high: 0, medium: 0, low: 0 };

	// Convert API risky files to page format
	const riskyFiles = (apiData?.riskyFiles?.files || []).map((f) => ({
		file: f.filePath,
		risk: f.riskScore,
		riskLevel: (f.riskLevel === "high" ? "high" : f.riskLevel === "medium" ? "medium" : "low") as "critical" | "high" | "medium" | "low",
		reason: `Volatility: ${f.volatilityScore}% • ${f.coupledFilesCount} coupled files • ${f.importersCount} importers`,
		coupledFiles: [], // Would need separate query for coupled file names
		lastModified: f.lastAnalyzedAt ? formatTimeAgo(f.lastAnalyzedAt) : "Unknown",
		modifiedBy: "Unknown",
		commits: 0,
	}));

	// Convert API activity to page format
	const recentActivity = (apiData?.activity?.activities || []).map((a) => ({
		type: (a.type === "pr" ? "prevented" : a.type === "analysis" ? "analysis" : "safe") as "analysis" | "prevented" | "safe",
		file: a.filePath || "Unknown file",
		risk: a.riskLevel === "high" ? 75 : a.riskLevel === "medium" ? 50 : 25,
		time: formatTimeAgo(a.timestamp),
		result: a.description,
	}));

	// Convert API coupling to page format
	const couplingPairs = (apiData?.coupling?.pairs || []).map((p) => ({
		primary: p.file1,
		coupled: p.file2,
		strength: p.couplingScore,
		coChanges: p.coChangeCount,
	}));

	// Convert API chart data
	const chartData = (apiData?.chartData || []).map((d) => ({
		date: d.date,
		analyses: d.analyses,
		prevented: d.prevented,
		avgRisk: d.avgRisk,
	}));

	// Convert API contributors
	const topContributors = (apiData?.contributors || []).map((c) => ({
		name: c.name,
		avatar: c.avatar || null,
		commits: c.commits,
		filesOwned: c.filesOwned,
	}));

	// If no contributors from API, add owner as default
	if (topContributors.length === 0 && owner) {
		topContributors.push({
			name: owner,
			avatar: `https://github.com/${owner}.png`,
			commits: 0,
			filesOwned: 0,
		});
	}

	return {
		name: repoName,
		fullName: contextRepo.fullName,
		description: `Repository ${contextRepo.fullName}`,
		health: stats?.healthScore || 0,
		trend: stats?.trend || "stable",
		lastSync: lastSyncText,
		defaultBranch: "main",
		isPrivate: contextRepo.isPrivate,
		stats: {
			totalFiles: 0,
			analyzedFiles: 0,
			totalAnalyses: stats?.totalAnalyses || 0,
			issuesPrevented: stats?.issuesPrevented || 0,
			avgRiskScore: stats?.avgRiskScore || 0,
			criticalFiles: riskDistribution.high, // Map high to critical for display
			highRiskFiles: riskDistribution.medium,
			// Comparison metrics - calculate from stats if available
			issuesPreventedChange: stats?.issuesPreventedChange,
			avgRiskScoreChange: stats?.avgRiskScoreChange,
			totalAnalysesChange: stats?.totalAnalysesChange,
		},
		riskDistribution: {
			critical: 0, // We only track high/medium/low in the API
			high: riskDistribution.high,
			medium: riskDistribution.medium,
			low: riskDistribution.low,
		},
		topContributors,
		recentActivity,
		riskyFiles,
		couplingPairs,
		weeklyTrend: [], // Not currently used
		chartData: chartData.length > 0 ? chartData : generateEmptyChartData(),
	};
};

// Generate placeholder chart data for repos with no analyses yet
// Creates a subtle wave pattern that looks intentional but doesn't imply real data
const generateEmptyChartData = () => {
	const data = [];
	const now = new Date();
	for (let i = 29; i >= 0; i--) {
		const date = new Date(now);
		date.setDate(date.getDate() - i);
		data.push({
			date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
			analyses: 0,
			prevented: 0,
			avgRisk: 0,
		});
	}
	return data;
};

// Check if chart data has any real activity
const hasChartActivity = (chartData: Array<{ analyses: number; prevented: number }>) => {
	return chartData.some(d => d.analyses > 0 || d.prevented > 0);
};

function formatTimeAgo(timestamp: number): string {
	const now = Date.now();
	const diff = now - timestamp;
	const minutes = Math.floor(diff / 60000);
	const hours = Math.floor(diff / 3600000);
	const days = Math.floor(diff / 86400000);

	if (minutes < 1) return "just now";
	if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
	if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
	return `${days} day${days === 1 ? '' : 's'} ago`;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getRiskColor(risk: number) {
	if (risk >= 75) return "text-red-500";
	if (risk >= 50) return "text-orange-500";
	if (risk >= 25) return "text-yellow-500";
	return "text-primary";
}

function getRiskBg(risk: number) {
	if (risk >= 75) return "bg-red-500";
	if (risk >= 50) return "bg-orange-500";
	if (risk >= 25) return "bg-yellow-500";
	return "bg-primary";
}

function getRiskBgLight(risk: number) {
	if (risk >= 75) return "bg-red-500/10";
	if (risk >= 50) return "bg-orange-500/10";
	if (risk >= 25) return "bg-yellow-500/10";
	return "bg-primary/10";
}

function getHealthColor(health: number) {
	if (health >= 80) return "text-primary";
	if (health >= 60) return "text-yellow-500";
	if (health >= 40) return "text-orange-500";
	return "text-red-500";
}

function getHealthBg(health: number) {
	if (health >= 80) return "bg-primary";
	if (health >= 60) return "bg-yellow-500";
	if (health >= 40) return "bg-orange-500";
	return "bg-red-500";
}

function getActivityIcon(type: string) {
	switch (type) {
		case "prevented":
			return <ShieldCheck className="h-4 w-4 text-primary" />;
		case "safe":
			return <CheckCircle2 className="h-4 w-4 text-primary" />;
		case "analysis":
		default:
			return <Zap className="h-4 w-4 text-primary" />;
	}
}

// Trend indicator component for showing comparison metrics
function TrendIndicator({ change, inverted = false }: { change?: number; inverted?: boolean }) {
	if (change === undefined || change === 0) return null;

	const isPositive = inverted ? change < 0 : change > 0;
	const absChange = Math.abs(change);

	return (
		<span
			className={cn(
				"inline-flex items-center gap-0.5 text-xs font-medium",
				isPositive ? "text-green-500" : "text-red-500"
			)}
			aria-label={`${isPositive ? "Increased" : "Decreased"} by ${absChange}% from last period`}
		>
			{change > 0 ? (
				<TrendingUp className="h-3 w-3" aria-hidden="true" />
			) : (
				<TrendingDown className="h-3 w-3" aria-hidden="true" />
			)}
			{absChange}%
		</span>
	);
}

// ============================================================================
// INTERACTIVE CHART COMPONENT
// ============================================================================

interface ChartDataPoint {
	date: string;
	analyses: number;
	prevented: number;
	avgRisk: number;
}

function InteractiveChart({ chartData }: { chartData: ChartDataPoint[] }) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
	const chartHeight = 280;

	// Check if we have real data
	const hasData = hasChartActivity(chartData);
	const maxAnalyses = hasData ? Math.max(...chartData.map((d) => d.analyses), 1) : 10; // Use 10 as placeholder max

	const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
		if (!containerRef.current) return;

		const rect = containerRef.current.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const relativeX = x / rect.width;
		const index = Math.round(relativeX * (chartData.length - 1));
		const clampedIndex = Math.max(0, Math.min(chartData.length - 1, index));

		setHoveredIndex(clampedIndex);
	}, [chartData.length]);

	const handleMouseLeave = useCallback(() => {
		setHoveredIndex(null);
	}, []);

	const hoveredData = hoveredIndex !== null ? chartData[hoveredIndex] : null;

	// When no data, show a "waiting for data" placeholder chart
	if (!hasData) {
		return (
			<div className="mt-16 w-full">
				{/* Header */}
				<div className="max-w-6xl mx-auto px-4 md:px-6 mb-3">
					<div className="flex items-center justify-between">
						<span className="text-sm text-muted-foreground">Last 30 days</span>
						<div className="flex items-center gap-4 text-xs">
							<div className="flex items-center gap-1.5">
								<div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
								<span className="text-muted-foreground/50">Analyses</span>
							</div>
							<div className="flex items-center gap-1.5">
								<div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
								<span className="text-muted-foreground/50">Prevented</span>
							</div>
						</div>
					</div>
				</div>

				{/* Empty State Chart Container */}
				<div className="relative h-56 md:h-72">
					{/* Placeholder SVG with subtle pattern */}
					<svg
						className="w-full h-full"
						viewBox={`0 0 1200 ${chartHeight}`}
						preserveAspectRatio="none"
					>
						<defs>
							<linearGradient id="emptyGradient" x1="0" x2="0" y1="0" y2="1">
								<stop offset="0%" stopColor="currentColor" stopOpacity="0.03" />
								<stop offset="100%" stopColor="currentColor" stopOpacity="0" />
							</linearGradient>
							<pattern id="dotPattern" patternUnits="userSpaceOnUse" width="40" height="40">
								<circle cx="2" cy="2" r="1" fill="currentColor" opacity="0.1" />
							</pattern>
						</defs>

						{/* Subtle dot pattern background */}
						<rect width="1200" height={chartHeight} fill="url(#dotPattern)" />

						{/* Decorative baseline */}
						<line
							x1="0"
							y1={chartHeight - 1}
							x2="1200"
							y2={chartHeight - 1}
							stroke="currentColor"
							strokeWidth="1"
							opacity="0.1"
						/>

						{/* Horizontal grid lines (very subtle) */}
						{[0.25, 0.5, 0.75].map((ratio, i) => (
							<line
								key={i}
								x1="0"
								y1={chartHeight * ratio}
								x2="1200"
								y2={chartHeight * ratio}
								stroke="currentColor"
								strokeWidth="1"
								strokeDasharray="4 8"
								opacity="0.05"
							/>
						))}
					</svg>

					{/* Centered "Waiting for data" message */}
					<div className="absolute inset-0 flex flex-col items-center justify-center">
						<div className="flex items-center gap-2 text-muted-foreground/60 mb-2">
							<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
								<path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
							</svg>
							<span className="text-sm font-medium">Waiting for activity</span>
						</div>
						<p className="text-xs text-muted-foreground/40 max-w-xs text-center">
							Analysis data will appear here as you open pull requests and use Memoria
						</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="mt-16 w-full">
			{/* Header */}
			<div className="max-w-6xl mx-auto px-4 md:px-6 mb-3">
				<div className="flex items-center justify-between">
					<span className="text-sm text-muted-foreground">Last 30 days</span>
					<div className="flex items-center gap-4 text-xs">
						<div className="flex items-center gap-1.5">
							<div className="w-2 h-2 rounded-full bg-primary" />
							<span className="text-muted-foreground">Analyses</span>
						</div>
						<div className="flex items-center gap-1.5">
							<div className="w-2 h-2 rounded-full bg-emerald-500" />
							<span className="text-muted-foreground">Prevented</span>
						</div>
					</div>
				</div>
			</div>

			{/* Chart Container */}
			<div
				ref={containerRef}
				className="relative h-56 md:h-72"
				onMouseMove={handleMouseMove}
				onMouseLeave={handleMouseLeave}
			>
				{/* SVG Chart */}
				<svg
					className="w-full h-full"
					viewBox={`0 0 1200 ${chartHeight}`}
					preserveAspectRatio="none"
				>
					<defs>
						<linearGradient id="analysisGradientLight" x1="0" x2="0" y1="0" y2="1">
							<stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.15" />
							<stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
						</linearGradient>
						<linearGradient id="analysisGradientDark" x1="0" x2="0" y1="0" y2="1">
							<stop offset="0%" stopColor="white" stopOpacity="0.12" />
							<stop offset="100%" stopColor="white" stopOpacity="0" />
						</linearGradient>
					</defs>

					{/* Analyses area fill - Light mode */}
					<path
						d={`
							M 0 ${chartHeight}
							${chartData
								.map((d, i) => {
									const x = (i / (chartData.length - 1)) * 1200;
									const y = chartHeight - (d.analyses / maxAnalyses) * (chartHeight - 20);
									return `L ${x} ${y}`;
								})
								.join(" ")}
							L 1200 ${chartHeight}
							Z
						`}
						fill="url(#analysisGradientLight)"
						className="dark:hidden"
					/>
					{/* Analyses area fill - Dark mode */}
					<path
						d={`
							M 0 ${chartHeight}
							${chartData
								.map((d, i) => {
									const x = (i / (chartData.length - 1)) * 1200;
									const y = chartHeight - (d.analyses / maxAnalyses) * (chartHeight - 20);
									return `L ${x} ${y}`;
								})
								.join(" ")}
							L 1200 ${chartHeight}
							Z
						`}
						fill="url(#analysisGradientDark)"
						className="hidden dark:block"
					/>

					{/* Analyses line */}
					<path
						d={`
							M 0 ${chartHeight - (chartData[0].analyses / maxAnalyses) * (chartHeight - 20)}
							${chartData
								.slice(1)
								.map((d, i) => {
									const x = ((i + 1) / (chartData.length - 1)) * 1200;
									const y = chartHeight - (d.analyses / maxAnalyses) * (chartHeight - 20);
									return `L ${x} ${y}`;
								})
								.join(" ")}
						`}
						fill="none"
						stroke="hsl(var(--primary))"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>

					{/* Prevented line */}
					<path
						d={`
							M 0 ${chartHeight - (chartData[0].prevented / maxAnalyses) * (chartHeight - 20)}
							${chartData
								.slice(1)
								.map((d, i) => {
									const x = ((i + 1) / (chartData.length - 1)) * 1200;
									const y = chartHeight - (d.prevented / maxAnalyses) * (chartHeight - 20);
									return `L ${x} ${y}`;
								})
								.join(" ")}
						`}
						fill="none"
						stroke="rgb(34, 197, 94)"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeDasharray="4 4"
					/>

					{/* Hover indicator - Light mode (dots) */}
					{hoveredIndex !== null && (
						<g className="dark:hidden">
							{/* Vertical line */}
							<line
								x1={(hoveredIndex / (chartData.length - 1)) * 1200}
								y1={10}
								x2={(hoveredIndex / (chartData.length - 1)) * 1200}
								y2={chartHeight}
								stroke="hsl(var(--foreground))"
								strokeWidth="1"
								opacity="0.2"
							/>

							{/* Analysis point */}
							<circle
								cx={(hoveredIndex / (chartData.length - 1)) * 1200}
								cy={chartHeight - (chartData[hoveredIndex].analyses / maxAnalyses) * (chartHeight - 20)}
								r="4"
								fill="hsl(var(--primary))"
								stroke="hsl(var(--background))"
								strokeWidth="2"
							/>

							{/* Prevented point */}
							<circle
								cx={(hoveredIndex / (chartData.length - 1)) * 1200}
								cy={chartHeight - (chartData[hoveredIndex].prevented / maxAnalyses) * (chartHeight - 20)}
								r="4"
								fill="rgb(34, 197, 94)"
								stroke="hsl(var(--background))"
								strokeWidth="2"
							/>
						</g>
					)}

					{/* Hover indicator - Dark mode (blue vertical line) */}
					{hoveredIndex !== null && (
						<g className="hidden dark:block">
							<line
								x1={(hoveredIndex / (chartData.length - 1)) * 1200}
								y1={0}
								x2={(hoveredIndex / (chartData.length - 1)) * 1200}
								y2={chartHeight}
								stroke="rgb(59, 130, 246)"
								strokeWidth="1.5"
							/>
						</g>
					)}
				</svg>

				{/* Hover Tooltip - Light mode */}
				{hoveredData && hoveredIndex !== null && (
					<div
						className="absolute z-50 pointer-events-none dark:hidden"
						style={{
							left: `${(hoveredIndex / (chartData.length - 1)) * 100}%`,
							top: '8px',
							transform: `translateX(${hoveredIndex > chartData.length * 0.7 ? '-100%' : hoveredIndex < chartData.length * 0.3 ? '0' : '-50%'})`,
						}}
					>
						<div className="bg-popover border border-border rounded-sm shadow-lg px-3 py-2">
							<div className="text-xs text-muted-foreground mb-1">{hoveredData.date}</div>
							<div className="flex items-center gap-3">
								<div className="flex items-center gap-1.5">
									<div className="w-2 h-2 rounded-full bg-primary" />
									<span className="text-sm font-medium tabular-nums">{hoveredData.analyses}</span>
								</div>
								<div className="flex items-center gap-1.5">
									<div className="w-2 h-2 rounded-full bg-emerald-500" />
									<span className="text-sm font-medium tabular-nums text-emerald-500">{hoveredData.prevented}</span>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* Hover Tooltip - Dark mode (at top of blue line) */}
				{hoveredData && hoveredIndex !== null && (
					<div
						className="absolute z-50 pointer-events-none hidden dark:block"
						style={{
							left: `${(hoveredIndex / (chartData.length - 1)) * 100}%`,
							top: '-8px',
							transform: `translateX(-50%) translateY(-100%)`,
						}}
					>
						<div className="bg-blue-500 text-white rounded-sm shadow-lg px-3 py-2">
							<div className="text-xs opacity-80 mb-1">{hoveredData.date}</div>
							<div className="flex items-center gap-3">
								<div className="flex items-center gap-1.5">
									<span className="text-sm font-medium tabular-nums">{hoveredData.analyses}</span>
									<span className="text-xs opacity-70">analyses</span>
								</div>
								<div className="flex items-center gap-1.5">
									<span className="text-sm font-medium tabular-nums">{hoveredData.prevented}</span>
									<span className="text-xs opacity-70">prevented</span>
								</div>
							</div>
						</div>
						{/* Arrow pointing down */}
						<div className="w-0 h-0 mx-auto border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-blue-500" />
					</div>
				)}

				{/* Interactive hover zones (invisible) */}
				<div className="absolute inset-0 flex">
					{chartData.map((_, i) => (
						<div
							key={i}
							className="flex-1 h-full cursor-crosshair"
							onMouseEnter={() => setHoveredIndex(i)}
						/>
					))}
				</div>
			</div>
		</div>
	);
}

// ============================================================================
// COMPONENT
// ============================================================================

// Pagination component for reuse
function Pagination({
	currentPage,
	totalPages,
	totalItems,
	itemsPerPage,
	onPageChange,
	itemLabel = "items",
}: {
	currentPage: number;
	totalPages: number;
	totalItems: number;
	itemsPerPage: number;
	onPageChange: (page: number) => void;
	itemLabel?: string;
}) {
	const startItem = (currentPage - 1) * itemsPerPage + 1;
	const endItem = Math.min(currentPage * itemsPerPage, totalItems);

	return (
		<div className="flex items-center justify-between pt-4">
			<div className="text-sm text-muted-foreground">
				Showing <span className="font-medium text-foreground">{startItem}</span> to{" "}
				<span className="font-medium text-foreground">{endItem}</span> of{" "}
				<span className="font-medium text-foreground">{totalItems.toLocaleString()}</span> {itemLabel}
			</div>
			<div className="flex items-center gap-2">
				<button
					onClick={() => onPageChange(currentPage - 1)}
					disabled={currentPage === 1}
					className={cn(
						"p-2 rounded-sm border border-border/50 bg-secondary/50 transition-colors",
						currentPage === 1
							? "opacity-50 cursor-not-allowed"
							: "hover:bg-secondary hover:border-border"
					)}
				>
					<ChevronLeft className="h-4 w-4" />
				</button>
				<div className="flex items-center gap-1">
					{/* Show first page */}
					{currentPage > 2 && (
						<>
							<button
								onClick={() => onPageChange(1)}
								className="px-3 py-1.5 text-sm rounded-sm border border-border/50 bg-secondary/50 hover:bg-secondary hover:border-border transition-colors"
							>
								1
							</button>
							{currentPage > 3 && (
								<span className="px-2 text-muted-foreground">...</span>
							)}
						</>
					)}
					{/* Show current page and neighbors */}
					{Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
						const page = Math.max(1, Math.min(currentPage - 1, totalPages - 2)) + i;
						if (page < 1 || page > totalPages) return null;
						return (
							<button
								key={page}
								onClick={() => onPageChange(page)}
								className={cn(
									"px-3 py-1.5 text-sm rounded-sm border transition-colors",
									page === currentPage
										? "bg-primary text-primary-foreground border-primary"
										: "border-border/50 bg-secondary/50 hover:bg-secondary hover:border-border"
								)}
							>
								{page}
							</button>
						);
					})}
					{/* Show last page */}
					{currentPage < totalPages - 1 && (
						<>
							{currentPage < totalPages - 2 && (
								<span className="px-2 text-muted-foreground">...</span>
							)}
							<button
								onClick={() => onPageChange(totalPages)}
								className="px-3 py-1.5 text-sm rounded-sm border border-border/50 bg-secondary/50 hover:bg-secondary hover:border-border transition-colors"
							>
								{totalPages}
							</button>
						</>
					)}
				</div>
				<button
					onClick={() => onPageChange(currentPage + 1)}
					disabled={currentPage === totalPages}
					className={cn(
						"p-2 rounded-sm border border-border/50 bg-secondary/50 transition-colors",
						currentPage === totalPages
							? "opacity-50 cursor-not-allowed"
							: "hover:bg-secondary hover:border-border"
					)}
				>
					<ChevronRight className="h-4 w-4" />
				</button>
			</div>
		</div>
	);
}

export default function RepositoryDetailPage() {
	const params = useParams();
	const repoName = decodeURIComponent(params.name as string);

	// Get real repository data from dashboard context
	const { repositories } = useDashboard();

	// Tab and hover states
	const [selectedTab, setSelectedTab] = useState<"files" | "activity" | "coupling">("files");
	const [hoveredRiskSegment, setHoveredRiskSegment] = useState<string | null>(null);
	const [hoveredStat, setHoveredStat] = useState<string | null>(null);

	// Pagination state for each tab
	const [filesPage, setFilesPage] = useState(1);
	const [activityPage, setActivityPage] = useState(1);
	const [couplingPage, setCouplingPage] = useState(1);

	// Paginated data state
	const [paginatedRiskyFiles, setPaginatedRiskyFiles] = useState<{ files: ApiRiskyFile[]; total: number } | null>(null);
	const [paginatedActivity, setPaginatedActivity] = useState<{ activities: ApiActivity[]; total: number } | null>(null);
	const [paginatedCoupling, setPaginatedCoupling] = useState<{ pairs: ApiCouplingPair[]; total: number } | null>(null);

	// Find the repository from context
	const contextRepo = useMemo(() => {
		return repositories.find(r => {
			if (r.fullName === repoName) return true;
			const repoOnly = r.fullName.split('/').pop();
			return repoOnly === repoName;
		});
	}, [repositories, repoName]);

	// Fetch real data from API
	const { data: apiData, loading: apiLoading, error: apiError } = useRepositoryStats(contextRepo?._id);

	// Fetch paginated data when tab or page changes
	useEffect(() => {
		if (!contextRepo?._id) return;

		const fetchData = async () => {
			try {
				if (selectedTab === "files") {
					const result = await fetchPaginatedData(
						contextRepo._id,
						"riskyFiles",
						ITEMS_PER_PAGE,
						(filesPage - 1) * ITEMS_PER_PAGE
					);
					if (result.riskyFiles) {
						setPaginatedRiskyFiles(result.riskyFiles);
					}
				} else if (selectedTab === "activity") {
					const result = await fetchPaginatedData(
						contextRepo._id,
						"activity",
						ITEMS_PER_PAGE,
						(activityPage - 1) * ITEMS_PER_PAGE
					);
					if (result.activity) {
						setPaginatedActivity(result.activity);
					}
				} else if (selectedTab === "coupling") {
					const result = await fetchPaginatedData(
						contextRepo._id,
						"coupling",
						ITEMS_PER_PAGE,
						(couplingPage - 1) * ITEMS_PER_PAGE
					);
					if (result.coupling) {
						setPaginatedCoupling(result.coupling);
					}
				}
			} catch (err) {
				console.error("Failed to fetch paginated data:", err);
			}
		};

		fetchData();
	}, [contextRepo?._id, selectedTab, filesPage, activityPage, couplingPage]);

	// Build repo data from API response
	const repo = useMemo(() => {
		if (!contextRepo) return null;
		return buildRepoDataFromApi(contextRepo, apiData);
	}, [contextRepo, apiData]);

	// Reset pagination when switching tabs
	const handleTabChange = (tab: typeof selectedTab) => {
		setSelectedTab(tab);
	};

	// Convert API paginated data to page format
	const paginatedFiles = useMemo(() => {
		if (!paginatedRiskyFiles?.files) {
			// Fallback to repo data if paginated data not loaded yet
			if (!repo) return [];
			const start = (filesPage - 1) * ITEMS_PER_PAGE;
			return repo.riskyFiles.slice(start, start + ITEMS_PER_PAGE);
		}
		return paginatedRiskyFiles.files.map((f) => ({
			file: f.filePath,
			risk: f.riskScore,
			riskLevel: (f.riskLevel === "high" ? "high" : f.riskLevel === "medium" ? "medium" : "low") as "critical" | "high" | "medium" | "low",
			reason: `Volatility: ${f.volatilityScore}% • ${f.coupledFilesCount} coupled files • ${f.importersCount} importers`,
			coupledFiles: [],
			lastModified: f.lastAnalyzedAt ? formatTimeAgo(f.lastAnalyzedAt) : "Unknown",
			modifiedBy: "Unknown",
			commits: 0,
		}));
	}, [paginatedRiskyFiles, repo?.riskyFiles, filesPage]);

	const paginatedActivityItems = useMemo(() => {
		if (!paginatedActivity?.activities) {
			// Fallback to repo data
			if (!repo) return [];
			const start = (activityPage - 1) * ITEMS_PER_PAGE;
			return repo.recentActivity.slice(start, start + ITEMS_PER_PAGE);
		}
		return paginatedActivity.activities.map((a) => ({
			type: (a.type === "pr" ? "prevented" : a.type === "analysis" ? "analysis" : "safe") as "analysis" | "prevented" | "safe",
			file: a.filePath || "Unknown file",
			risk: a.riskLevel === "high" ? 75 : a.riskLevel === "medium" ? 50 : 25,
			time: formatTimeAgo(a.timestamp),
			result: a.description,
		}));
	}, [paginatedActivity, repo?.recentActivity, activityPage]);

	const paginatedCouplingItems = useMemo(() => {
		if (!paginatedCoupling?.pairs) {
			// Fallback to repo data
			if (!repo) return [];
			const start = (couplingPage - 1) * ITEMS_PER_PAGE;
			return repo.couplingPairs.slice(start, start + ITEMS_PER_PAGE);
		}
		return paginatedCoupling.pairs.map((p) => ({
			primary: p.file1,
			coupled: p.file2,
			strength: p.couplingScore,
			coChanges: p.coChangeCount,
		}));
	}, [paginatedCoupling, repo?.couplingPairs, couplingPage]);

	// Total pages for each tab - use API totals if available
	const totalFilesCount = paginatedRiskyFiles?.total ?? (repo?.riskyFiles.length || 0);
	const totalActivityCount = paginatedActivity?.total ?? (repo?.recentActivity.length || 0);
	const totalCouplingCount = paginatedCoupling?.total ?? (repo?.couplingPairs.length || 0);

	const totalFilesPages = Math.ceil(totalFilesCount / ITEMS_PER_PAGE);
	const totalActivityPages = Math.ceil(totalActivityCount / ITEMS_PER_PAGE);
	const totalCouplingPages = Math.ceil(totalCouplingCount / ITEMS_PER_PAGE);

	const totalRiskFiles = repo
		? repo.riskDistribution.critical + repo.riskDistribution.high + repo.riskDistribution.medium + repo.riskDistribution.low
		: 0;

	// Helper to safely calculate percentage (avoids division by zero)
	const getRiskPercent = (count: number) => {
		if (totalRiskFiles === 0) return 0;
		return (count / totalRiskFiles) * 100;
	};

	// Scan status polling
	const [scanStatus, setScanStatus] = useState<{
		status: "none" | "pending" | "running" | "completed" | "failed";
		progress: number;
		processedFiles: number;
		totalFiles: number;
	} | null>(null);

	useEffect(() => {
		if (!contextRepo?._id) return;

		const fetchScanStatus = async () => {
			try {
				const response = await fetch(`/api/repositories/${contextRepo._id}/scan`);
				if (response.ok) {
					const data = await response.json();
					setScanStatus({
						status: data.status || "none",
						progress: data.progress || 0,
						processedFiles: data.processedFiles || 0,
						totalFiles: data.totalFiles || 0,
					});
				}
			} catch (error) {
				console.error("Failed to fetch scan status:", error);
			}
		};

		// Initial fetch
		fetchScanStatus();

		// Poll every 2 seconds while scanning
		const interval = setInterval(() => {
			fetchScanStatus();
		}, 2000);

		return () => clearInterval(interval);
	}, [contextRepo?._id]);

	// Stop polling when scan completes
	const isScanning = scanStatus?.status === "pending" || scanStatus?.status === "running";

	// Show loading skeleton while fetching initial data
	if (apiLoading) {
		return <PageSkeleton />;
	}

	// Show empty state if repository not found
	if (!repo) {
		return <EmptyRepositoryState repoName={repoName} />;
	}

	return (
		<div className="pt-2 pb-40">
			{/* Scanning Progress Banner */}
			{isScanning && scanStatus && (
				<SyncingBanner
					progress={scanStatus.progress}
					filesAnalyzed={scanStatus.processedFiles}
					totalFiles={scanStatus.totalFiles}
				/>
			)}

			{/* Repository Header - Clean Identity */}
			<div className="max-w-6xl mx-auto px-4 md:px-6 pt-6">
				<div className="flex items-center gap-4">
					<div className="w-12 h-12 rounded-sm bg-secondary/50 border border-border/50 flex items-center justify-center">
						<GitBranch className="h-6 w-6 text-muted-foreground" />
					</div>
					<div>
						<div className="flex items-center gap-3">
							<h1 className="text-2xl font-semibold">{repo.name}</h1>
							{repo.isPrivate && (
								<span className="text-xs px-2 py-0.5 bg-secondary/50 border border-border/50 rounded-sm text-muted-foreground">Private</span>
							)}
						</div>
						<div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
							<span>{repo.fullName}</span>
							<span>·</span>
							<span>{repo.defaultBranch}</span>
							<span>·</span>
							<span>Synced {repo.lastSync}</span>
						</div>
					</div>
				</div>
			</div>

			{/* Health Score + Key Metrics */}
			<div className="max-w-6xl mx-auto px-4 md:px-6 pt-8">
				<div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
					{/* Health Score */}
					<div className="flex items-center gap-6">
						<div className="relative">
							<svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
								<circle
									cx="50"
									cy="50"
									r="40"
									fill="none"
									stroke="currentColor"
									strokeWidth="8"
									className="text-muted/20"
								/>
								<circle
									cx="50"
									cy="50"
									r="40"
									fill="none"
									stroke="currentColor"
									strokeWidth="8"
									strokeLinecap="round"
									strokeDasharray={`${repo.health * 2.51} 251`}
									className={getHealthColor(repo.health)}
								/>
							</svg>
							<div className="absolute inset-0 flex items-center justify-center">
								<span className={cn("text-2xl font-bold", getHealthColor(repo.health))}>
									{repo.health}
								</span>
							</div>
						</div>
						<div>
							<div className="flex items-center gap-2">
								<span className="text-lg font-medium">Repository Health</span>
								{repo.trend === "up" && (
									<div className="flex items-center gap-1 text-green-500 text-sm">
										<TrendingUp className="h-3.5 w-3.5" />
										<span>Improving</span>
									</div>
								)}
								{repo.trend === "down" && (
									<div className="flex items-center gap-1 text-red-500 text-sm">
										<TrendingDown className="h-3.5 w-3.5" />
										<span>Declining</span>
									</div>
								)}
							</div>
							<p className="text-sm text-muted-foreground mt-1">
								{repo.health >= 80 && "Your codebase is in great shape"}
								{repo.health >= 60 && repo.health < 80 && "Some areas need attention"}
								{repo.health < 60 && "Multiple high-risk files detected"}
							</p>
						</div>
					</div>

					{/* Quick Stats - Interactive (no layout shift) */}
					<div className="flex flex-wrap gap-8">
						<div
							className={cn(
								"p-3 -m-3 rounded-sm transition-colors cursor-default",
								hoveredStat === "prevented" && "bg-green-500/10"
							)}
							onMouseEnter={() => setHoveredStat("prevented")}
							onMouseLeave={() => setHoveredStat(null)}
						>
							<div className="flex items-baseline gap-2">
								<span className={cn("text-3xl font-semibold tabular-nums transition-colors", hoveredStat === "prevented" && "text-green-500")}>
									{repo.stats.issuesPrevented}
								</span>
								<TrendIndicator change={repo.stats.issuesPreventedChange} />
							</div>
							<div className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
								<ShieldCheck className={cn("h-3.5 w-3.5 transition-colors", hoveredStat === "prevented" && "text-green-500")} aria-hidden="true" />
								Issues Prevented
							</div>
						</div>
						<div
							className={cn(
								"p-3 -m-3 rounded-sm transition-colors cursor-default",
								hoveredStat === "risk" && "bg-primary/10"
							)}
							onMouseEnter={() => setHoveredStat("risk")}
							onMouseLeave={() => setHoveredStat(null)}
						>
							<div className="flex items-baseline gap-2">
								<span className={cn("text-3xl font-semibold tabular-nums transition-colors", hoveredStat === "risk" && "text-primary")}>
									{repo.stats.avgRiskScore}
								</span>
								<TrendIndicator change={repo.stats.avgRiskScoreChange} inverted />
							</div>
							<div className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
								<Shield className={cn("h-3.5 w-3.5 transition-colors", hoveredStat === "risk" && "text-primary")} aria-hidden="true" />
								Avg Risk Score
							</div>
						</div>
						<div
							className={cn(
								"p-3 -m-3 rounded-sm transition-colors cursor-default",
								hoveredStat === "analyses" && "bg-primary/10"
							)}
							onMouseEnter={() => setHoveredStat("analyses")}
							onMouseLeave={() => setHoveredStat(null)}
						>
							<div className="flex items-baseline gap-2">
								<span className={cn("text-3xl font-semibold tabular-nums transition-colors", hoveredStat === "analyses" && "text-primary")}>
									{repo.stats.totalAnalyses}
								</span>
								<TrendIndicator change={repo.stats.totalAnalysesChange} />
							</div>
							<div className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
								<Zap className={cn("h-3.5 w-3.5 transition-colors", hoveredStat === "analyses" && "text-primary")} aria-hidden="true" />
								Total Analyses
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Actionable Insights */}
			{(() => {
				const insights: { type: "warning" | "success" | "info"; message: string; action?: string }[] = [];

				// Generate insights based on repository data
				if (repo.riskDistribution.high > 5) {
					insights.push({
						type: "warning",
						message: `${repo.riskDistribution.high} high-risk files need attention`,
						action: "Review files →",
					});
				}
				if (repo.trend === "down" && repo.health < 70) {
					insights.push({
						type: "warning",
						message: "Repository health is declining. Consider reviewing recent changes.",
					});
				}
				if (repo.stats.issuesPrevented > 0 && repo.stats.issuesPreventedChange && repo.stats.issuesPreventedChange > 20) {
					insights.push({
						type: "success",
						message: `Great work! ${repo.stats.issuesPreventedChange}% more issues prevented this period.`,
					});
				}
				if (repo.health >= 90) {
					insights.push({
						type: "success",
						message: "Excellent repository health! Keep up the good practices.",
					});
				}
				if (repo.stats.totalAnalyses === 0) {
					insights.push({
						type: "info",
						message: "No analyses yet. Create a pull request to see Memoria in action.",
					});
				}

				if (insights.length === 0) return null;

				return (
					<div className="max-w-6xl mx-auto px-4 md:px-6 mt-6">
						<div className="flex flex-wrap gap-3">
							{insights.slice(0, 3).map((insight, index) => (
								<div
									key={index}
									className={cn(
										"flex items-center gap-2 px-3 py-2 rounded-sm text-sm border",
										insight.type === "warning" && "bg-orange-500/10 border-orange-500/20 text-orange-700 dark:text-orange-400",
										insight.type === "success" && "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400",
										insight.type === "info" && "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400"
									)}
								>
									{insight.type === "warning" && <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />}
									{insight.type === "success" && <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />}
									{insight.type === "info" && <Zap className="h-4 w-4 shrink-0" aria-hidden="true" />}
									<span>{insight.message}</span>
									{insight.action && (
										<button
											className="font-medium hover:underline shrink-0"
											onClick={() => setSelectedTab("files")}
										>
											{insight.action}
										</button>
									)}
								</div>
							))}
						</div>
					</div>
				);
			})()}

			{/* Risk Distribution Bar - Interactive (no layout shift) */}
			<div className="max-w-6xl mx-auto px-4 md:px-6 mt-8">
				<div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
					<div className="flex-1 h-3 rounded-sm overflow-visible flex bg-muted/30 relative">
						<div
							className={cn(
								"bg-red-500 transition-all cursor-pointer relative",
								hoveredRiskSegment === "critical" && "brightness-110 z-10"
							)}
							style={{ width: `${getRiskPercent(repo.riskDistribution.critical)}%` }}
							onMouseEnter={() => setHoveredRiskSegment("critical")}
							onMouseLeave={() => setHoveredRiskSegment(null)}
						>
							<div className={cn(
								"absolute -top-10 left-1/2 -translate-x-1/2 bg-red-500 text-white text-xs px-2 py-1 rounded-sm whitespace-nowrap shadow-lg transition-opacity pointer-events-none",
								hoveredRiskSegment === "critical" ? "opacity-100" : "opacity-0"
							)}>
								{repo.riskDistribution.critical} critical ({Math.round(getRiskPercent(repo.riskDistribution.critical))}%)
							</div>
						</div>
						<div
							className={cn(
								"bg-orange-500 transition-all cursor-pointer relative",
								hoveredRiskSegment === "high" && "brightness-110 z-10"
							)}
							style={{ width: `${getRiskPercent(repo.riskDistribution.high)}%` }}
							onMouseEnter={() => setHoveredRiskSegment("high")}
							onMouseLeave={() => setHoveredRiskSegment(null)}
						>
							<div className={cn(
								"absolute -top-10 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-xs px-2 py-1 rounded-sm whitespace-nowrap shadow-lg transition-opacity pointer-events-none",
								hoveredRiskSegment === "high" ? "opacity-100" : "opacity-0"
							)}>
								{repo.riskDistribution.high} high ({Math.round(getRiskPercent(repo.riskDistribution.high))}%)
							</div>
						</div>
						<div
							className={cn(
								"bg-yellow-500 transition-all cursor-pointer relative",
								hoveredRiskSegment === "medium" && "brightness-110 z-10"
							)}
							style={{ width: `${getRiskPercent(repo.riskDistribution.medium)}%` }}
							onMouseEnter={() => setHoveredRiskSegment("medium")}
							onMouseLeave={() => setHoveredRiskSegment(null)}
						>
							<div className={cn(
								"absolute -top-10 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-xs px-2 py-1 rounded-sm whitespace-nowrap shadow-lg transition-opacity pointer-events-none",
								hoveredRiskSegment === "medium" ? "opacity-100" : "opacity-0"
							)}>
								{repo.riskDistribution.medium} medium ({Math.round(getRiskPercent(repo.riskDistribution.medium))}%)
							</div>
						</div>
						<div
							className={cn(
								"bg-primary transition-all cursor-pointer relative",
								hoveredRiskSegment === "low" && "brightness-110 z-10"
							)}
							style={{ width: `${getRiskPercent(repo.riskDistribution.low)}%` }}
							onMouseEnter={() => setHoveredRiskSegment("low")}
							onMouseLeave={() => setHoveredRiskSegment(null)}
						>
							<div className={cn(
								"absolute -top-10 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-sm whitespace-nowrap shadow-lg transition-opacity pointer-events-none",
								hoveredRiskSegment === "low" ? "opacity-100" : "opacity-0"
							)}>
								{repo.riskDistribution.low} low ({Math.round(getRiskPercent(repo.riskDistribution.low))}%)
							</div>
						</div>
					</div>
					<div className="flex items-center gap-3 sm:gap-4 text-xs shrink-0 flex-wrap">
						<div
							className={cn(
								"flex items-center gap-1.5 px-2 py-1 -mx-2 -my-1 rounded-sm transition-colors cursor-pointer",
								hoveredRiskSegment === "critical" && "bg-red-500/10"
							)}
							onMouseEnter={() => setHoveredRiskSegment("critical")}
							onMouseLeave={() => setHoveredRiskSegment(null)}
						>
							<div className="w-2 h-2 rounded-sm bg-red-500" />
							<span className="text-muted-foreground hidden sm:inline">Critical</span>
							<span className={cn("font-medium", hoveredRiskSegment === "critical" && "text-red-500")}>{repo.riskDistribution.critical}</span>
						</div>
						<div
							className={cn(
								"flex items-center gap-1.5 px-2 py-1 -mx-2 -my-1 rounded-sm transition-colors cursor-pointer",
								hoveredRiskSegment === "high" && "bg-orange-500/10"
							)}
							onMouseEnter={() => setHoveredRiskSegment("high")}
							onMouseLeave={() => setHoveredRiskSegment(null)}
						>
							<div className="w-2 h-2 rounded-sm bg-orange-500" />
							<span className="text-muted-foreground hidden sm:inline">High</span>
							<span className={cn("font-medium", hoveredRiskSegment === "high" && "text-orange-500")}>{repo.riskDistribution.high}</span>
						</div>
						<div
							className={cn(
								"flex items-center gap-1.5 px-2 py-1 -mx-2 -my-1 rounded-sm transition-colors cursor-pointer",
								hoveredRiskSegment === "medium" && "bg-yellow-500/10"
							)}
							onMouseEnter={() => setHoveredRiskSegment("medium")}
							onMouseLeave={() => setHoveredRiskSegment(null)}
						>
							<div className="w-2 h-2 rounded-sm bg-yellow-500" />
							<span className="text-muted-foreground hidden sm:inline">Medium</span>
							<span className={cn("font-medium", hoveredRiskSegment === "medium" && "text-yellow-500")}>{repo.riskDistribution.medium}</span>
						</div>
						<div
							className={cn(
								"flex items-center gap-1.5 px-2 py-1 -mx-2 -my-1 rounded-sm transition-colors cursor-pointer",
								hoveredRiskSegment === "low" && "bg-primary/10"
							)}
							onMouseEnter={() => setHoveredRiskSegment("low")}
							onMouseLeave={() => setHoveredRiskSegment(null)}
						>
							<div className="w-2 h-2 rounded-sm bg-primary" />
							<span className="text-muted-foreground hidden sm:inline">Low</span>
							<span className={cn("font-medium", hoveredRiskSegment === "low" && "text-primary")}>{repo.riskDistribution.low}</span>
						</div>
					</div>
				</div>
			</div>

			{/* Full Width Interactive Analysis Chart */}
			<InteractiveChart chartData={repo.chartData} />

			{/* Tab Navigation */}
			<div className="max-w-6xl mx-auto px-4 md:px-6 mt-10">
				<div className="flex gap-1 border-b border-border/50">
					{[
						{ id: "files", label: "High Risk Files", count: totalFilesCount },
						{ id: "activity", label: "Recent Activity", count: totalActivityCount },
						{ id: "coupling", label: "File Coupling", count: totalCouplingCount },
					].map((tab) => (
						<button
							key={tab.id}
							onClick={() => handleTabChange(tab.id as typeof selectedTab)}
							className={cn(
								"px-4 py-2.5 text-sm font-medium transition-colors relative flex items-center gap-2",
								selectedTab === tab.id
									? "text-foreground"
									: "text-muted-foreground hover:text-foreground"
							)}
						>
							{tab.label}
							{tab.count !== undefined && tab.count > 0 && (
								<span className={cn(
									"px-1.5 py-0.5 text-xs rounded-sm",
									selectedTab === tab.id ? "bg-foreground text-background" : "bg-muted"
								)}>
									{tab.count}
								</span>
							)}
							{selectedTab === tab.id && (
								<div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
							)}
						</button>
					))}
				</div>
			</div>

			{/* Tab Content */}
			<div className="max-w-6xl mx-auto px-4 md:px-6 mt-6">
				{/* High Risk Files - Interactive with Pagination */}
				{selectedTab === "files" && (
					<div className="space-y-4">
						{totalFilesCount === 0 ? (
							<EmptyFilesState />
						) : paginatedFiles.map((file, i) => (
							<div
								key={`${file.file}-${i}`}
								className={cn(
									"p-4 rounded-sm border transition-colors cursor-pointer",
									file.riskLevel === "critical" ? "border-red-500/30 bg-red-500/5 hover:border-red-500/50 hover:bg-red-500/10" : "border-border/50 bg-secondary/30 hover:border-border hover:bg-secondary/50"
								)}
							>
								<div className="flex items-start justify-between gap-4">
									<div className="flex items-start gap-3 min-w-0 flex-1">
										<div className={cn(
											"w-10 h-10 rounded-sm flex items-center justify-center shrink-0",
											getRiskBgLight(file.risk)
										)}>
											{file.riskLevel === "critical" ? (
												<ShieldAlert className={cn("h-5 w-5", getRiskColor(file.risk))} />
											) : (
												<AlertTriangle className={cn("h-5 w-5", getRiskColor(file.risk))} />
											)}
										</div>
										<div className="min-w-0 flex-1">
											<div className="flex items-center gap-2 flex-wrap">
												<span className="font-medium text-sm font-mono">{file.file}</span>
											</div>
											<p className="text-sm text-muted-foreground mt-1">{file.reason}</p>
											<div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
												<div className="flex items-center gap-1">
													<Clock className="h-3 w-3" />
													{file.lastModified}
												</div>
												<div className="flex items-center gap-1">
													<Users className="h-3 w-3" />
													{file.modifiedBy}
												</div>
												<div className="flex items-center gap-1">
													<GitCommit className="h-3 w-3" />
													{file.commits} commits
												</div>
												<div className="flex items-center gap-1">
													<Link2 className="h-3 w-3" />
													{file.coupledFiles.length} coupled
												</div>
											</div>
										</div>
									</div>
									<div className="text-right shrink-0">
										<div className={cn("text-2xl font-bold tabular-nums", getRiskColor(file.risk))}>
											{file.risk}
										</div>
										<div className="text-xs text-muted-foreground uppercase tracking-wide">
											{file.riskLevel}
										</div>
									</div>
								</div>
								{/* Coupled files - limit to MAX_COUPLED_FILES_SHOWN */}
								<div className="mt-4 pt-3 border-t border-border/50">
									<div className="text-xs text-muted-foreground mb-2">Coupled with:</div>
									<div className="flex flex-wrap gap-1.5">
										{file.coupledFiles.slice(0, MAX_COUPLED_FILES_SHOWN).map((coupled) => (
											<span
												key={coupled}
												className="px-2 py-1 text-xs bg-secondary/50 border border-border/50 rounded-sm font-mono"
											>
												{coupled}
											</span>
										))}
										{file.coupledFiles.length > MAX_COUPLED_FILES_SHOWN && (
											<span className="px-2 py-1 text-xs bg-secondary/50 border border-border/50 rounded-sm text-muted-foreground">
												+{file.coupledFiles.length - MAX_COUPLED_FILES_SHOWN} more
											</span>
										)}
									</div>
								</div>
							</div>
						))}
						{/* Pagination */}
						{totalFilesPages > 1 && (
							<Pagination
								currentPage={filesPage}
								totalPages={totalFilesPages}
								totalItems={totalFilesCount}
								itemsPerPage={ITEMS_PER_PAGE}
								onPageChange={setFilesPage}
								itemLabel="files"
							/>
						)}
					</div>
				)}

				{/* Recent Activity - with Pagination */}
				{selectedTab === "activity" && (
					<div>
						{totalActivityCount === 0 ? (
							<EmptyActivityState />
						) : (
							<>
								<div className="space-y-1">
									{paginatedActivityItems.map((activity, i) => (
										<div
											key={`${activity.file}-${i}`}
											className="flex items-center gap-4 py-3 border-b border-border/50 last:border-0"
										>
											<div className="w-8 h-8 rounded-sm bg-secondary/50 border border-border/50 flex items-center justify-center shrink-0">
												{getActivityIcon(activity.type)}
											</div>
											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-2">
													<span className="text-sm font-medium font-mono truncate">{activity.file}</span>
												</div>
												<div className="text-sm text-muted-foreground mt-0.5">{activity.result}</div>
											</div>
											<div className="flex items-center gap-3 shrink-0">
												<div className="flex items-center gap-1.5">
													<div className={cn("w-2 h-2 rounded-sm", getRiskBg(activity.risk))} />
													<span className={cn("font-medium tabular-nums text-sm", getRiskColor(activity.risk))}>
														{activity.risk}
													</span>
												</div>
												<span className="text-xs text-muted-foreground w-16 text-right">{activity.time}</span>
											</div>
										</div>
									))}
								</div>
								{/* Pagination */}
								{totalActivityPages > 1 && (
									<Pagination
										currentPage={activityPage}
										totalPages={totalActivityPages}
										totalItems={totalActivityCount}
										itemsPerPage={ITEMS_PER_PAGE}
										onPageChange={setActivityPage}
										itemLabel="activities"
									/>
								)}
							</>
						)}
					</div>
				)}

				{/* File Coupling - with Pagination */}
				{selectedTab === "coupling" && (
					<div>
						{totalCouplingCount === 0 ? (
							<EmptyCouplingState />
						) : (
							<>
								<p className="text-sm text-muted-foreground mb-4">
									Files that frequently change together. When modifying one, always check the coupled file.
								</p>
								<div className="space-y-4">
									{paginatedCouplingItems.map((pair, i) => (
										<div
											key={`${pair.primary}-${pair.coupled}-${i}`}
											className="p-4 rounded-sm border border-border/50 bg-secondary/30 hover:bg-secondary/50 transition-all"
										>
											<div className="flex items-center gap-3">
												<div className="flex-1 min-w-0">
													<div className="flex items-center gap-2 text-sm">
														<FileCode className="h-4 w-4 text-muted-foreground shrink-0" />
														<span className="font-medium font-mono truncate">{pair.primary}</span>
													</div>
												</div>
												<div className="flex items-center gap-2 px-3 text-muted-foreground">
													<div className="w-8 h-0.5 bg-gradient-to-r from-primary/50 to-primary rounded" />
													<span className="text-xs font-medium">{pair.strength}%</span>
													<div className="w-8 h-0.5 bg-gradient-to-l from-primary/50 to-primary rounded" />
												</div>
												<div className="flex-1 min-w-0 text-right">
													<div className="flex items-center justify-end gap-2 text-sm">
														<span className="font-medium font-mono truncate">{pair.coupled}</span>
														<FileCode className="h-4 w-4 text-muted-foreground shrink-0" />
													</div>
												</div>
											</div>
											<div className="flex items-center justify-end mt-3 text-xs text-muted-foreground">
												<span>{pair.coChanges} co-changes detected</span>
											</div>
										</div>
									))}
								</div>
								{/* Pagination */}
								{totalCouplingPages > 1 && (
									<Pagination
										currentPage={couplingPage}
										totalPages={totalCouplingPages}
										totalItems={totalCouplingCount}
										itemsPerPage={ITEMS_PER_PAGE}
										onPageChange={setCouplingPage}
										itemLabel="coupling pairs"
									/>
								)}
							</>
						)}
					</div>
				)}
			</div>

			{/* Contributors */}
			<div className="max-w-6xl mx-auto px-4 md:px-6 mt-12">
				<h2 className="font-medium mb-5">Top Contributors</h2>
				<div className="flex flex-wrap gap-4">
					{repo.topContributors.map((contributor, i) => (
						<div
							key={i}
							className="flex items-center gap-3 p-3 rounded-sm border border-border/50 bg-secondary/30 hover:bg-secondary/50 transition-all"
						>
							{contributor.avatar ? (
								<img
									src={contributor.avatar}
									alt={contributor.name}
									className="w-10 h-10 rounded-sm"
								/>
							) : (
								<div className="w-10 h-10 rounded-sm bg-secondary/50 border border-border/50 flex items-center justify-center">
									<span className="text-sm font-medium">{contributor.name[0].toUpperCase()}</span>
								</div>
							)}
							<div>
								<div className="font-medium text-sm">{contributor.name}</div>
								<div className="text-xs text-muted-foreground">
									{contributor.commits} commits · {contributor.filesOwned} files
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
