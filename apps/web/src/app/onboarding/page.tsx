import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getConvexClient, callQuery, callMutation } from "@/lib/convex";
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
	}>>(convex, "scm:getInstallations", { orgId: org._id });

	// Filter to only active installations (not deleted or suspended)
	const activeInstallations = allInstallations?.filter(i => i.status === "active") || [];

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
