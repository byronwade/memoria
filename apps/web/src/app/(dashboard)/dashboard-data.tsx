import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getConvexClient, callQuery, callMutation } from "@/lib/convex";
import { getInstallation } from "@/lib/github/auth";

export interface DashboardOrganization {
	_id: string;
	name: string;
	slug: string;
	status: string;
	planId: string | null;
	maxRepos: number | null;
	trialEndsAt: number | null;
}

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

export interface DashboardData {
	user: DashboardUser;
	organizations: DashboardOrganization[];
	currentOrg: DashboardOrganization | null;
	repositories: DashboardRepository[];
	billingStatus: DashboardBillingStatus | null;
	needsOnboarding: boolean;
}

/**
 * Refresh installation statuses from GitHub API
 * This catches uninstalls/suspensions that weren't received via webhook
 */
async function refreshInstallationStatuses(
	convex: ReturnType<typeof getConvexClient>,
	orgId: string,
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
						orgId,
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
						orgId,
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

	// Get user's organizations
	const organizations = await callQuery<DashboardOrganization[]>(
		convex,
		"orgs:getUserOrganizations",
		{ userId: session.user._id }
	);

	// If no organizations, redirect to onboarding
	if (!organizations || organizations.length === 0) {
		return {
			user: session.user,
			organizations: [],
			currentOrg: null,
			repositories: [],
			billingStatus: null,
			needsOnboarding: true,
		};
	}

	const currentOrg = organizations[0];

	// Get installations for current org
	const allInstallations = await callQuery<Array<{
		_id: string;
		status: string;
		providerInstallationId: string;
		accountLogin: string;
	}>>(
		convex,
		"scm:getInstallations",
		{ orgId: currentOrg._id }
	);

	// Auto-refresh installation status from GitHub for non-deleted installations
	// This catches uninstalls/suspensions that weren't received via webhook
	const refreshedInstallations = await refreshInstallationStatuses(
		convex,
		currentOrg._id,
		allInstallations || []
	);

	// Filter to only active installations
	const activeInstallations = refreshedInstallations.filter(i => i.status === "active");

	// Get repositories for current org
	const repositories = await callQuery<DashboardRepository[]>(
		convex,
		"scm:getRepositories",
		{ orgId: currentOrg._id }
	);

	// Get billing status
	const billingStatus = await callQuery<DashboardBillingStatus | null>(
		convex,
		"billing:getOrgBillingStatus",
		{ orgId: currentOrg._id }
	);

	// Check if needs onboarding:
	// - No active installations (app was uninstalled/suspended)
	// - No active repos
	const activeRepos = repositories?.filter(r => r.isActive) || [];
	const needsOnboarding = activeInstallations.length === 0 || activeRepos.length === 0;

	return {
		user: session.user,
		organizations: organizations || [],
		currentOrg,
		repositories: repositories || [],
		billingStatus,
		needsOnboarding,
	};
}
