"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal, api } from "../_generated/api";

/**
 * Handle installation events (created, deleted, suspend, unsuspend)
 */
export const handleInstallation = internalAction({
	args: { payload: v.any() },
	handler: async (ctx, args) => {
		const { action, installation, sender, repositories } = args.payload;

		console.log(`Installation event: ${action} for ${installation.id}`);

		if (action === "deleted" || action === "suspend") {
			// Mark installation as deleted/suspended
			await ctx.runMutation(internal.github.mutations.updateInstallationStatus, {
				providerInstallationId: String(installation.id),
				status: action === "deleted" ? "deleted" : "suspended",
			});
		} else if (action === "created") {
			// Handle new installation via webhook
			// This is a fallback if the Setup URL callback wasn't configured
			console.log(`New installation created by ${sender?.login || "unknown"}`);

			// Check if we have a user with this GitHub ID
			const account = installation.account;
			const accountLogin = account?.login || "unknown";
			const accountName = account?.name || null;
			const accountType = account?.type === "Organization" ? "org" : "user";

			// Try to find a user by GitHub login
			// Note: We need to find which user this belongs to
			// For now, we'll look for users who have linked this GitHub account
			const user = await ctx.runQuery(api.auth.getUserByGitHubId, {
				githubUserId: String(sender?.id || account?.id),
			});

			if (user) {
				// Get or create org for this user
				const orgs = await ctx.runQuery(api.orgs.getUserOrganizations, {
					userId: user._id,
				});

				let orgId: string;
				if (orgs && orgs.length > 0) {
					orgId = orgs[0]._id;
				} else {
					// Create a new org
					const result = await ctx.runMutation(api.orgs.createOrganization, {
						name: accountLogin,
						slug: accountLogin.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
						ownerUserId: user._id,
					});
					orgId = result.orgId;
				}

				// Create the installation
				await ctx.runMutation(api.scm.upsertInstallation, {
					providerType: "github",
					providerInstallationId: String(installation.id),
					orgId,
					accountType,
					accountLogin,
					accountName,
					permissions: installation.permissions,
					status: "active",
				});

				console.log(`Installation created for org: ${orgId}`);

				// Sync repositories if provided
				if (repositories && Array.isArray(repositories)) {
					const inst = await ctx.runQuery(api.scm.getInstallationByProviderId, {
						providerType: "github",
						providerInstallationId: String(installation.id),
					});

					if (inst) {
						for (const repo of repositories) {
							await ctx.runMutation(api.scm.upsertRepository, {
								orgId,
								scmInstallationId: inst._id,
								providerType: "github",
								providerRepoId: String(repo.id),
								fullName: repo.full_name,
								defaultBranch: repo.default_branch || "main",
								isPrivate: repo.private,
								isActive: true,
								languageHint: null,
								settings: null,
							});
							console.log(`Synced repository: ${repo.full_name}`);
						}
					}
				}
			} else {
				console.log(`No user found for GitHub ID ${sender?.id}. Installation will be linked when user logs in.`);
				// Store the installation anyway - it will be linked when the user visits the callback URL
				// or when they log in via OAuth
			}
		} else if (action === "unsuspend") {
			// Reactivate installation
			await ctx.runMutation(internal.github.mutations.updateInstallationStatus, {
				providerInstallationId: String(installation.id),
				status: "active",
			});
		}
	},
});

/**
 * Handle repository add/remove events
 */
export const handleRepoSync = internalAction({
	args: { payload: v.any() },
	handler: async (ctx, args) => {
		const { action, installation, repositories_added, repositories_removed } =
			args.payload;

		console.log(`Repo sync event: ${action} for installation ${installation.id}`);

		// Get installation from our database
		const inst = await ctx.runQuery(api.scm.getInstallationByProviderId, {
			providerType: "github",
			providerInstallationId: String(installation.id),
		});

		if (!inst) {
			console.error("Installation not found:", installation.id);
			return;
		}

		// Add new repositories
		if (repositories_added && Array.isArray(repositories_added)) {
			for (const repo of repositories_added) {
				await ctx.runMutation(api.scm.upsertRepository, {
					orgId: inst.orgId,
					scmInstallationId: inst._id,
					providerType: "github",
					providerRepoId: String(repo.id),
					fullName: repo.full_name,
					defaultBranch: repo.default_branch || "main",
					isPrivate: repo.private,
					isActive: true,
					languageHint: null,
					settings: null,
				});
				console.log(`Added repository: ${repo.full_name}`);
			}
		}

		// Mark removed repositories as inactive
		if (repositories_removed && Array.isArray(repositories_removed)) {
			for (const repo of repositories_removed) {
				await ctx.runMutation(internal.github.mutations.deactivateRepository, {
					providerRepoId: String(repo.id),
				});
				console.log(`Deactivated repository: ${repo.full_name}`);
			}
		}
	},
});

/**
 * Handle pull request events
 */
export const handlePullRequest = internalAction({
	args: { payload: v.any() },
	handler: async (ctx, args) => {
		const { action, pull_request, repository, installation } = args.payload;

		console.log(`PR event: ${action} for ${repository.full_name}#${pull_request.number}`);

		// Only analyze on opened, synchronize (new commits), or reopened
		if (!["opened", "synchronize", "reopened"].includes(action)) {
			console.log(`Skipping action: ${action}`);
			return;
		}

		// Get installation
		const inst = await ctx.runQuery(api.scm.getInstallationByProviderId, {
			providerType: "github",
			providerInstallationId: String(installation.id),
		});

		if (!inst) {
			console.error("Installation not found for PR:", installation.id);
			return;
		}

		// Get or create repository record
		let repo = await ctx.runQuery(api.scm.getRepositoryByProviderId, {
			providerType: "github",
			providerRepoId: String(repository.id),
		});

		if (!repo) {
			const { repoId } = await ctx.runMutation(api.scm.upsertRepository, {
				orgId: inst.orgId,
				scmInstallationId: inst._id,
				providerType: "github",
				providerRepoId: String(repository.id),
				fullName: repository.full_name,
				defaultBranch: repository.default_branch || "main",
				isPrivate: repository.private,
				isActive: true,
				languageHint: repository.language || null,
				settings: null,
			});
			repo = await ctx.runQuery(api.scm.getRepository, { repoId });
		}

		if (!repo) {
			console.error("Failed to get/create repository");
			return;
		}

		// Upsert pull request
		const { pullRequestId } = await ctx.runMutation(api.scm.upsertPullRequest, {
			repoId: repo._id,
			providerType: "github",
			providerPullRequestId: String(pull_request.id),
			number: pull_request.number,
			title: pull_request.title,
			body: pull_request.body || null,
			state: pull_request.state === "open" ? "open" : "closed",
			isDraft: pull_request.draft || false,
			authorProviderUserId: String(pull_request.user.id),
			authorLogin: pull_request.user.login,
			sourceBranch: pull_request.head.ref,
			targetBranch: pull_request.base.ref,
			createdAtProvider: new Date(pull_request.created_at).getTime(),
			updatedAtProvider: pull_request.updated_at
				? new Date(pull_request.updated_at).getTime()
				: null,
			mergedAtProvider: pull_request.merged_at
				? new Date(pull_request.merged_at).getTime()
				: null,
			closedAtProvider: pull_request.closed_at
				? new Date(pull_request.closed_at).getTime()
				: null,
			labels: pull_request.labels?.map((l: { name: string }) => l.name) || [],
			metadata: {
				headSha: pull_request.head.sha,
				baseSha: pull_request.base.sha,
			},
		});

		console.log(`PR upserted: ${pullRequestId}`);

		// Trigger analysis
		try {
			await ctx.runAction(internal.github.analysis.runPRAnalysis, {
				pullRequestId,
				installationId: installation.id,
				repoFullName: repository.full_name,
				prNumber: pull_request.number,
			});
		} catch (error) {
			console.error("Analysis trigger failed:", error);
		}
	},
});
