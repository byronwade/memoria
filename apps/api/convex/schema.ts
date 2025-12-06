import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const nullableString = v.union(v.string(), v.null());
const nullableNumber = v.union(v.number(), v.null());
const nullableJson = v.union(v.any(), v.null());

// Helper for creating union of literals
const literals = <T extends string>(...values: T[]) =>
	v.union(...values.map((val) => v.literal(val))) as ReturnType<typeof v.literal<T>>;

export default defineSchema({
	users: defineTable({
		email: v.string(),
		emailVerified: v.boolean(),
		name: nullableString,
		avatarUrl: nullableString,
		primaryOrgId: v.optional(v.id("organizations")),
		githubUserId: nullableString,
		gitlabUserId: nullableString,
		role: literals("user", "admin", "support"),
		createdAt: v.number(),
		updatedAt: nullableNumber,
	})
		.index("by_email", ["email"])
		.index("by_githubUserId", ["githubUserId"])
		.index("by_gitlabUserId", ["gitlabUserId"]),

	identities: defineTable({
		userId: v.id("users"),
		provider: literals("github", "gitlab", "email", "password", "other"),
		providerUserId: v.string(),
		accessToken: nullableString,
		refreshToken: nullableString,
		expiresAt: nullableNumber,
		metadata: nullableJson,
		createdAt: v.number(),
		updatedAt: nullableNumber,
	})
		.index("by_userId", ["userId"])
		.index("by_provider_user", ["provider", "providerUserId"]),

	sessions: defineTable({
		userId: v.id("users"),
		sessionToken: v.string(),
		userAgent: nullableString,
		ipAddress: nullableString,
		expiresAt: v.number(),
		createdAt: v.number(),
		revokedAt: nullableNumber,
	})
		.index("by_sessionToken", ["sessionToken"])
		.index("by_userId", ["userId"]),

	api_tokens: defineTable({
		name: v.string(),
		ownerType: literals("user", "organization"),
		userId: v.optional(v.id("users")),
		orgId: v.optional(v.id("organizations")),
		tokenHash: v.string(),
		scopes: v.array(v.string()),
		lastUsedAt: nullableNumber,
		createdAt: v.number(),
		revokedAt: nullableNumber,
	})
		.index("by_owner_user", ["ownerType", "userId"])
		.index("by_owner_org", ["ownerType", "orgId"])
		.index("by_tokenHash", ["tokenHash"]),

	organizations: defineTable({
		name: v.string(),
		slug: v.string(),
		ownerUserId: v.id("users"),
		planId: v.optional(v.id("billing_plans")),
		stripeCustomerId: nullableString,
		stripeSubscriptionId: nullableString,
		maxRepos: nullableNumber,
		maxAnalysesPerMonth: nullableNumber,
		status: literals("active", "trial", "past_due", "canceled", "suspended"),
		trialEndsAt: nullableNumber,
		createdAt: v.number(),
		updatedAt: nullableNumber,
	})
		.index("by_slug", ["slug"])
		.index("by_ownerUserId", ["ownerUserId"])
		.index("by_stripeCustomerId", ["stripeCustomerId"]),

	org_memberships: defineTable({
		orgId: v.id("organizations"),
		userId: v.id("users"),
		role: literals("owner", "admin", "member", "viewer"),
		createdAt: v.number(),
	})
		.index("by_org", ["orgId"])
		.index("by_user", ["userId"])
		.index("by_org_user", ["orgId", "userId"]),

	org_invitations: defineTable({
		orgId: v.id("organizations"),
		email: v.string(),
		invitedByUserId: v.id("users"),
		role: literals("admin", "member", "viewer"),
		token: v.string(),
		status: literals("pending", "accepted", "expired", "revoked"),
		expiresAt: v.number(),
		createdAt: v.number(),
		acceptedAt: nullableNumber,
	})
		.index("by_org", ["orgId"])
		.index("by_email", ["email"])
		.index("by_token", ["token"]),

	org_settings: defineTable({
		orgId: v.id("organizations"),
		riskCommentMode: literals("short", "detailed"),
		enableSlackNotifications: v.boolean(),
		slackWebhookUrl: nullableString,
		defaultProvider: v.union(
			v.literal("github"),
			v.literal("gitlab"),
			v.literal("bitbucket"),
			v.literal("other"),
			v.null(),
		),
		analysisDepth: literals("fast", "standard", "deep"),
		createdAt: v.number(),
		updatedAt: nullableNumber,
	}).index("by_org", ["orgId"]),

	billing_plans: defineTable({
		name: v.string(),
		stripePriceId: nullableString,
		tier: literals("free", "solo", "team", "enterprise"),
		maxRepos: nullableNumber,
		maxAnalysesPerMonth: nullableNumber,
		pricePerMonthUsd: v.number(),
		features: v.array(v.string()),
		isPublic: v.boolean(),
		createdAt: v.number(),
		updatedAt: nullableNumber,
	}).index("by_tier", ["tier"]),

	billing_customers: defineTable({
		orgId: v.id("organizations"),
		stripeCustomerId: v.string(),
		defaultPaymentMethodId: nullableString,
		metadata: nullableJson,
		createdAt: v.number(),
		updatedAt: nullableNumber,
	})
		.index("by_org", ["orgId"])
		.index("by_stripeCustomerId", ["stripeCustomerId"]),

	billing_subscriptions: defineTable({
		orgId: v.id("organizations"),
		stripeSubscriptionId: v.string(),
		planId: v.id("billing_plans"),
		status: literals("active", "trialing", "past_due", "canceled", "incomplete", "paused"),
		currentPeriodStart: v.number(),
		currentPeriodEnd: v.number(),
		cancelAtPeriodEnd: v.boolean(),
		canceledAt: nullableNumber,
		metadata: nullableJson,
		createdAt: v.number(),
		updatedAt: nullableNumber,
	})
		.index("by_org", ["orgId"])
		.index("by_stripeSubscriptionId", ["stripeSubscriptionId"]),

	billing_usage: defineTable({
		orgId: v.id("organizations"),
		periodStart: v.number(),
		periodEnd: v.number(),
		prAnalysesCount: v.number(),
		reposActiveCount: v.number(),
		extraUsageMetadata: nullableJson,
		createdAt: v.number(),
	})
		.index("by_org", ["orgId"])
		.index("by_org_period", ["orgId", "periodStart", "periodEnd"]),

	billing_events: defineTable({
		stripeEventId: v.string(),
		type: v.string(),
		payload: v.any(),
		processedAt: nullableNumber,
		createdAt: v.number(),
	}).index("by_stripeEventId", ["stripeEventId"]),

	scm_providers: defineTable({
		type: literals("github", "gitlab", "bitbucket", "other"),
		name: v.string(),
		apiBaseUrl: v.string(),
		webBaseUrl: v.string(),
		appId: nullableString,
		config: nullableJson,
		createdAt: v.number(),
		updatedAt: nullableNumber,
	}).index("by_type", ["type"]),

	scm_installations: defineTable({
		providerType: literals("github", "gitlab", "bitbucket", "other"),
		providerInstallationId: v.string(),
		orgId: v.id("organizations"),
		accountType: literals("user", "org"),
		accountLogin: v.string(),
		accountName: nullableString,
		permissions: nullableJson,
		status: literals("active", "suspended", "deleted"),
		lastSyncedAt: nullableNumber,
		createdAt: v.number(),
		updatedAt: nullableNumber,
	})
		.index("by_org", ["orgId"])
		.index("by_providerInstallation", ["providerType", "providerInstallationId"]),

	repositories: defineTable({
		orgId: v.id("organizations"),
		scmInstallationId: v.id("scm_installations"),
		providerType: literals("github", "gitlab", "bitbucket", "other"),
		providerRepoId: v.string(),
		fullName: v.string(),
		defaultBranch: v.string(),
		isPrivate: v.boolean(),
		isActive: v.boolean(),
		languageHint: nullableString,
		settings: nullableJson,
		lastAnalyzedAt: nullableNumber,
		createdAt: v.number(),
		updatedAt: nullableNumber,
	})
		.index("by_org", ["orgId"])
		.index("by_installation", ["scmInstallationId"])
		.index("by_provider_repo", ["providerType", "providerRepoId"])
		.index("by_fullName", ["providerType", "fullName"]),

	repository_sync_state: defineTable({
		repoId: v.id("repositories"),
		lastFullCloneAt: nullableNumber,
		lastFetchAt: nullableNumber,
		lastSyncStatus: literals("ok", "error", "pending"),
		lastSyncErrorMessage: nullableString,
		createdAt: v.number(),
		updatedAt: nullableNumber,
	}).index("by_repoId", ["repoId"]),

	pull_requests: defineTable({
		repoId: v.id("repositories"),
		providerType: literals("github", "gitlab", "bitbucket", "other"),
		providerPullRequestId: v.string(),
		number: v.number(),
		title: v.string(),
		body: nullableString,
		state: literals("open", "closed", "merged"),
		isDraft: v.boolean(),
		authorProviderUserId: v.string(),
		authorLogin: v.string(),
		sourceBranch: v.string(),
		targetBranch: v.string(),
		createdAtProvider: v.number(),
		updatedAtProvider: nullableNumber,
		mergedAtProvider: nullableNumber,
		closedAtProvider: nullableNumber,
		lastAnalyzedAt: nullableNumber,
		lastAnalysisId: v.optional(v.id("analyses")),
		labels: v.array(v.string()),
		metadata: nullableJson,
	})
		.index("by_repo_number", ["repoId", "number"])
		.index("by_repo_state", ["repoId", "state"])
		.index("by_providerId", ["providerType", "providerPullRequestId"]),

	commits: defineTable({
		repoId: v.id("repositories"),
		providerType: literals("github", "gitlab", "bitbucket", "other"),
		providerCommitSha: v.string(),
		authorName: v.string(),
		authorEmail: v.string(),
		message: v.string(),
		committedAt: v.number(),
		metadata: nullableJson,
	}).index("by_repo_sha", ["repoId", "providerCommitSha"]),

	pull_request_engagement: defineTable({
		pullRequestId: v.id("pull_requests"),
		providerType: literals("github", "gitlab", "bitbucket", "other"),
		type: literals("comment", "review", "approval", "request_changes"),
		providerEventId: v.string(),
		actorProviderUserId: v.string(),
		actorLogin: v.string(),
		body: nullableString,
		createdAtProvider: v.number(),
		metadata: nullableJson,
	})
		.index("by_pullRequest", ["pullRequestId"])
		.index("by_providerEvent", ["providerType", "providerEventId"]),

	analyses: defineTable({
		orgId: v.id("organizations"),
		repoId: v.id("repositories"),
		pullRequestId: v.optional(v.id("pull_requests")),
		commitSha: nullableString,
		analysisType: literals("pull_request", "commit", "manual"),
		engineVersion: v.string(),
		riskLevel: literals("low", "medium", "high", "informational"),
		score: nullableNumber,
		changedFiles: v.array(v.string()),
		missingCoChangedFiles: v.array(
			v.object({
				file: v.string(),
				probability: v.number(),
			}),
		),
		suggestedTests: v.array(v.string()),
		summary: v.string(),
		rawResult: v.any(),
		commentPosted: v.boolean(),
		commentUrl: nullableString,
		createdAt: v.number(),
		durationMs: nullableNumber,
	})
		.index("by_org", ["orgId"])
		.index("by_repo", ["repoId"])
		.index("by_pullRequest", ["pullRequestId"])
		.index("by_repo_createdAt", ["repoId", "createdAt"]),

	analysis_findings: defineTable({
		analysisId: v.id("analyses"),
		kind: literals(
			"co_change_missing",
			"hotspot_file",
			"test_missing",
			"config_warning",
			"other",
		),
		severity: literals("low", "medium", "high"),
		filePath: nullableString,
		details: v.string(),
		data: nullableJson,
		createdAt: v.number(),
	})
		.index("by_analysis", ["analysisId"])
		.index("by_filePath", ["filePath"]),

	events: defineTable({
		orgId: v.optional(v.id("organizations")),
		userId: v.optional(v.id("users")),
		repoId: v.optional(v.id("repositories")),
		pullRequestId: v.optional(v.id("pull_requests")),
		type: v.string(),
		context: nullableJson,
		createdAt: v.number(),
	})
		.index("by_org_type", ["orgId", "type"])
		.index("by_repo_type", ["repoId", "type"])
		.index("by_type_createdAt", ["type", "createdAt"]),

	daily_org_stats: defineTable({
		orgId: v.id("organizations"),
		date: v.string(),
		prAnalysesCount: v.number(),
		highRiskAnalysesCount: v.number(),
		mediumRiskAnalysesCount: v.number(),
		lowRiskAnalysesCount: v.number(),
		averageRiskScore: nullableNumber,
		reposActiveCount: v.number(),
		createdAt: v.number(),
	}).index("by_org_date", ["orgId", "date"]),

	daily_repo_stats: defineTable({
		repoId: v.id("repositories"),
		date: v.string(),
		prAnalysesCount: v.number(),
		highRiskAnalysesCount: v.number(),
		mediumRiskAnalysesCount: v.number(),
		lowRiskAnalysesCount: v.number(),
		averageRiskScore: nullableNumber,
		createdAt: v.number(),
	}).index("by_repo_date", ["repoId", "date"]),

	file_risk_stats: defineTable({
		repoId: v.id("repositories"),
		filePath: v.string(),
		highRiskCount: v.number(),
		mediumRiskCount: v.number(),
		lowRiskCount: v.number(),
		totalAnalysesTouching: v.number(),
		lastTouchedAt: nullableNumber,
		createdAt: v.number(),
		updatedAt: nullableNumber,
	})
		.index("by_repo_file", ["repoId", "filePath"])
		.index("by_repo_highRisk", ["repoId", "highRiskCount"]),

	// Repository Scans - tracks full repository scan jobs
	repository_scans: defineTable({
		repositoryId: v.id("repositories"),
		status: literals("pending", "running", "completed", "failed"),
		triggeredBy: literals("onboarding", "manual", "scheduled"),
		startedAt: nullableNumber,
		completedAt: nullableNumber,
		errorMessage: nullableString,
		totalFiles: v.number(),
		processedFiles: v.number(),
		filesWithRisk: v.number(),
		createdAt: v.number(),
		updatedAt: nullableNumber,
	})
		.index("by_repository", ["repositoryId"])
		.index("by_status", ["status"])
		.index("by_repository_status", ["repositoryId", "status"]),

	// File Analyses - stores per-file analysis results from scans
	file_analyses: defineTable({
		scanId: v.id("repository_scans"),
		repositoryId: v.id("repositories"),
		filePath: v.string(),
		riskScore: v.number(), // 0-100
		riskLevel: literals("low", "medium", "high", "critical"),
		volatilityScore: v.number(),
		couplingScore: v.number(),
		driftScore: v.number(),
		importerCount: v.number(),
		coupledFiles: v.array(
			v.object({
				file: v.string(),
				score: v.number(),
				changeType: v.string(),
			}),
		),
		staticDependents: v.array(v.string()),
		lastAnalyzedAt: v.number(),
		createdAt: v.number(),
	})
		.index("by_scan", ["scanId"])
		.index("by_repository", ["repositoryId"])
		.index("by_repository_file", ["repositoryId", "filePath"])
		.index("by_repository_risk", ["repositoryId", "riskScore"]),

	inbound_webhooks: defineTable({
		source: literals("github", "gitlab", "stripe", "bitbucket", "other"),
		externalEventId: v.string(),
		eventType: v.string(),
		payload: v.any(),
		processedAt: nullableNumber,
		processingStatus: literals("pending", "processed", "error"),
		errorMessage: nullableString,
		createdAt: v.number(),
	})
		.index("by_source_eventId", ["source", "externalEventId"])
		.index("by_status", ["processingStatus"]),

	outbound_webhooks: defineTable({
		orgId: v.id("organizations"),
		targetType: literals("slack", "webhook", "other"),
		targetUrl: v.string(),
		eventType: v.string(),
		payload: v.any(),
		status: literals("pending", "sent", "error"),
		lastAttemptAt: nullableNumber,
		attemptCount: v.number(),
		errorMessage: nullableString,
		createdAt: v.number(),
	})
		.index("by_org_status", ["orgId", "status"]),

	feature_flags: defineTable({
		key: v.string(),
		description: nullableString,
		isGlobal: v.boolean(),
		defaultEnabled: v.boolean(),
		createdAt: v.number(),
		updatedAt: nullableNumber,
	}).index("by_key", ["key"]),

	org_feature_overrides: defineTable({
		orgId: v.id("organizations"),
		featureKey: v.string(),
		enabled: v.boolean(),
		createdAt: v.number(),
		updatedAt: nullableNumber,
	}).index("by_org_feature", ["orgId", "featureKey"]),

	gitlab_instances: defineTable({
		scmProviderId: v.id("scm_providers"),
		baseUrl: v.string(),
		name: v.string(),
		createdAt: v.number(),
		updatedAt: nullableNumber,
	}).index("by_baseUrl", ["baseUrl"]),
});

