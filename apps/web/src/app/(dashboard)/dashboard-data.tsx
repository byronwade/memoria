import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getConvexClient, callQuery } from "@/lib/convex";

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
	const allInstallations = await callQuery<Array<{ _id: string; status: string }>>(
		convex,
		"scm:getInstallations",
		{ orgId: currentOrg._id }
	);

	// Filter to only active installations
	const activeInstallations = allInstallations?.filter(i => i.status === "active") || [];

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
