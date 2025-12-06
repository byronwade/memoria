import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getConvexClient, callQuery, callMutation } from "@/lib/convex";
import { getInstallation } from "@/lib/github/auth";

export interface DashboardRepository {
	_id: string;
	fullName: string;
	isActive: boolean;
	isPrivate: boolean;
	lastAnalyzedAt: number | null;
}

export interface DashboardUser {
	_id: string;
	email: string;
	name: string | null;
	avatarUrl: string | null;
}

export interface DashboardBillingStatus {
	plan: {
		_id: string;
		name: string;
		tier: string;
		maxRepos: number | null;
		maxAnalysesPerMonth: number | null;
		pricePerMonthUsd: number;
	} | null;
	subscription?: {
		currentPeriodEnd: number;
	} | null;
	isTrialing: boolean;
	trialDaysRemaining: number;
	activeReposCount: number;
	stripeCustomerId: string | null;
}

// AI Control Plane Types
export interface DashboardGuardrail {
	_id: string;
	pattern: string;
	level: "warn" | "block";
	message: string;
	isEnabled: boolean;
	repoId?: string;
	createdBy: string;
	creatorName: string;
	createdAt: number;
}

export interface DashboardMemory {
	_id: string;
	context: string;
	tags: string[];
	linkedFiles: string[];
	repoId?: string;
	createdBy: string;
	creatorName: string;
	createdAt: number;
}

export interface DashboardInterventionStats {
	total: number;
	blocked: number;
	warned: number;
	today: number;
	last7Days: number;
	last30Days: number;
	byTool: Record<string, number>;
}

export interface DashboardGuardrailStats {
	total: number;
	enabled: number;
	blocking: number;
	warning: number;
	userWide: number;
	repoSpecific: number;
}

export interface DashboardData {
	user: DashboardUser;
	repositories: DashboardRepository[];
	billingStatus: DashboardBillingStatus | null;
	needsOnboarding: boolean;
	// AI Control Plane data
	guardrails: DashboardGuardrail[];
	memories: DashboardMemory[];
	interventionStats: DashboardInterventionStats | null;
	guardrailStats: DashboardGuardrailStats | null;
}

/**
 * Refresh installation statuses from GitHub API
 * This catches uninstalls/suspensions that weren't received via webhook
 */
async function refreshInstallationStatuses(
	convex: ReturnType<typeof getConvexClient>,
	userId: string,
	installations: Array<{
		_id: string;
		status: string;
		providerInstallationId: string;
		accountLogin: string;
	}>
): Promise<typeof installations> {
	// Only check non-deleted installations
	const toCheck = installations.filter(i => i.status !== "deleted");

	if (toCheck.length === 0) {
		return installations;
	}

	// Check each installation in parallel
	const results = await Promise.all(
		toCheck.map(async (inst) => {
			try {
				const githubInstallation = await getInstallation(
					parseInt(inst.providerInstallationId)
				);

				// Check if suspended
				const isSuspended = (githubInstallation as { suspended_at?: string | null }).suspended_at !== null;
				const newStatus = isSuspended ? "suspended" : "active";

				if (newStatus !== inst.status) {
					// Update status in database
					await callMutation(convex, "scm:upsertInstallation", {
						providerType: "github",
						providerInstallationId: inst.providerInstallationId,
						userId,
						accountType: "user",
						accountLogin: inst.accountLogin,
						accountName: null,
						permissions: {},
						status: newStatus,
					});
					console.log(`[auto-refresh] Installation ${inst.providerInstallationId} status: ${inst.status} -> ${newStatus}`);
					return { ...inst, status: newStatus };
				}

				return inst;
			} catch (error: unknown) {
				// If we get a 404, the installation was deleted
				const isNotFound =
					error instanceof Error &&
					(error.message.includes("404") || error.message.includes("Not Found"));

				if (isNotFound) {
					// Mark as deleted
					await callMutation(convex, "scm:upsertInstallation", {
						providerType: "github",
						providerInstallationId: inst.providerInstallationId,
						userId,
						accountType: "user",
						accountLogin: inst.accountLogin,
						accountName: null,
						permissions: {},
						status: "deleted",
					});
					console.log(`[auto-refresh] Installation ${inst.providerInstallationId} was deleted from GitHub`);
					return { ...inst, status: "deleted" };
				}

				// Other errors - keep current status
				console.error(`[auto-refresh] Failed to check installation ${inst.providerInstallationId}:`, error);
				return inst;
			}
		})
	);

	// Merge results back with deleted installations
	const deletedInstallations = installations.filter(i => i.status === "deleted");
	return [...results, ...deletedInstallations];
}

export async function getDashboardData(): Promise<DashboardData | null> {
	const session = await getSession();

	if (!session) {
		redirect("/login");
	}

	const convex = getConvexClient();
	const userId = session.user._id;

	// Get installations for user
	const allInstallations = await callQuery<Array<{
		_id: string;
		status: string;
		providerInstallationId: string;
		accountLogin: string;
	}>>(
		convex,
		"scm:getInstallations",
		{ userId }
	);

	// Auto-refresh installation status from GitHub for non-deleted installations
	// This catches uninstalls/suspensions that weren't received via webhook
	const refreshedInstallations = await refreshInstallationStatuses(
		convex,
		userId,
		allInstallations || []
	);

	// Filter to only active installations
	const activeInstallations = refreshedInstallations.filter(i => i.status === "active");

	// Get repositories for user
	const repositories = await callQuery<DashboardRepository[]>(
		convex,
		"scm:getRepositories",
		{ userId }
	);

	// Get billing status
	const billingStatus = await callQuery<DashboardBillingStatus | null>(
		convex,
		"billing:getUserBillingStatus",
		{ userId }
	);

	// Fetch AI Control Plane data
	const guardrails = await callQuery<DashboardGuardrail[]>(
		convex,
		"guardrails:listGuardrails",
		{ userId, includeDisabled: true }
	);

	const memories = await callQuery<DashboardMemory[]>(
		convex,
		"memories:listMemories",
		{ userId }
	);

	const interventionStats = await callQuery<DashboardInterventionStats | null>(
		convex,
		"interventions:getInterventionStats",
		{ userId }
	);

	const guardrailStats = await callQuery<DashboardGuardrailStats | null>(
		convex,
		"guardrails:getGuardrailStats",
		{ userId }
	);

	// Check if needs onboarding:
	// - No active installations (app was uninstalled/suspended)
	// - No active repos
	const activeRepos = repositories?.filter(r => r.isActive) || [];
	const needsOnboarding = activeInstallations.length === 0 || activeRepos.length === 0;

	return {
		user: session.user,
		repositories: repositories || [],
		billingStatus,
		needsOnboarding,
		// AI Control Plane data
		guardrails: guardrails || [],
		memories: memories || [],
		interventionStats,
		guardrailStats,
	};
}
