import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getConvexClient, callQuery, callMutation } from "@/lib/convex";
import { getInstallation } from "@/lib/github/auth";
import { OnboardingFlow } from "./onboarding-flow";

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

/**
 * Refresh installation statuses from GitHub API
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
	const toCheck = installations.filter(i => i.status !== "deleted");

	if (toCheck.length === 0) {
		return installations;
	}

	const results = await Promise.all(
		toCheck.map(async (inst) => {
			try {
				const githubInstallation = await getInstallation(
					parseInt(inst.providerInstallationId)
				);

				const isSuspended = (githubInstallation as { suspended_at?: string | null }).suspended_at !== null;
				const newStatus = isSuspended ? "suspended" : "active";

				if (newStatus !== inst.status) {
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
					return { ...inst, status: newStatus };
				}

				return inst;
			} catch (error: unknown) {
				const isNotFound =
					error instanceof Error &&
					(error.message.includes("404") || error.message.includes("Not Found"));

				if (isNotFound) {
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
					return { ...inst, status: "deleted" };
				}

				return inst;
			}
		})
	);

	const deletedInstallations = installations.filter(i => i.status === "deleted");
	return [...results, ...deletedInstallations];
}

async function getOnboardingStatus(userId: string): Promise<OnboardingStatus> {
	const convex = getConvexClient();

	// Get user's organizations
	const orgs = await callQuery<Array<{
		_id: string;
		name: string;
		status: string;
		trialEndsAt: number | null;
		stripeCustomerId: string | null;
	}>>(convex, "orgs:getUserOrganizations", { userId });

	const org = orgs?.[0] || null;

	if (!org) {
		return {
			hasOrganization: false,
			hasInstallation: false,
			hasRepositories: false,
			hasBillingSetup: false,
			organization: null,
			installations: [],
			repositories: [],
		};
	}

	// Get installations for org
	const allInstallations = await callQuery<Array<{
		_id: string;
		accountLogin: string;
		status: string;
		providerInstallationId: string;
	}>>(convex, "scm:getInstallations", { orgId: org._id });

	// Auto-refresh installation status from GitHub for non-deleted installations
	const refreshedInstallations = await refreshInstallationStatuses(
		convex,
		org._id,
		allInstallations || []
	);

	// Filter to only active installations (not deleted or suspended)
	const activeInstallations = refreshedInstallations.filter(i => i.status === "active");

	// Get repositories for org
	const repositories = await callQuery<Array<{
		_id: string;
		fullName: string;
		isActive: boolean;
		isPrivate: boolean;
	}>>(convex, "scm:getRepositories", { orgId: org._id });

	const activeRepos = repositories?.filter(r => r.isActive) || [];

	return {
		hasOrganization: true,
		hasInstallation: activeInstallations.length > 0,
		hasRepositories: activeRepos.length > 0,
		hasBillingSetup: !!org.stripeCustomerId,
		organization: org,
		installations: activeInstallations,
		repositories: repositories || [],
	};
}

export default async function OnboardingPage() {
	const session = await getSession();

	if (!session) {
		redirect("/login?redirect=/onboarding");
	}

	const status = await getOnboardingStatus(session.user._id);

	// If fully onboarded, redirect to dashboard
	if (status.hasOrganization && status.hasInstallation && status.hasRepositories) {
		redirect("/dashboard");
	}

	return (
		<OnboardingFlow
			userId={session.user._id}
			userEmail={session.user.email}
			userName={session.user.name ?? undefined}
			status={status}
		/>
	);
}
