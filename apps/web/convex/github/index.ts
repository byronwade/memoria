"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal, api } from "../_generated/api";

/**
 * Process incoming GitHub webhook
 * Dispatches to appropriate handler based on event type
 */
export const processWebhook = action({
	args: { webhookId: v.id("inbound_webhooks") },
	handler: async (ctx, args): Promise<{ success: boolean; error?: string; eventType?: string }> => {
		// Get webhook from database
		const webhook = await ctx.runQuery(api.webhooks.getWebhook, {
			webhookId: args.webhookId,
		});

		if (!webhook) {
			console.error("Webhook not found:", args.webhookId);
			return { success: false, error: "Webhook not found" };
		}

		if (webhook.processingStatus !== "pending") {
			console.log("Webhook already processed:", args.webhookId);
			return { success: false, error: "Already processed" };
		}

		const { eventType, payload } = webhook;

		try {
			switch (eventType) {
				case "installation":
					await ctx.runAction(internal.github.handlers.handleInstallation, {
						payload,
					});
					break;

				case "installation_repositories":
					await ctx.runAction(internal.github.handlers.handleRepoSync, {
						payload,
					});
					break;

				case "pull_request":
					await ctx.runAction(internal.github.handlers.handlePullRequest, {
						payload,
					});
					break;

				case "push":
					await ctx.runAction(internal.github.handlers.handlePush, {
						payload,
					});
					break;

				case "ping":
					// GitHub sends ping when webhook is first configured
					console.log("Ping event received");
					break;

				default:
					console.log(`Unhandled event type: ${eventType}`);
			}

			// Mark webhook as processed
			await ctx.runMutation(api.webhooks.markWebhookProcessed, {
				webhookId: args.webhookId,
				status: "processed",
			});

			return { success: true, eventType };
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			console.error("Webhook processing error:", errorMessage);

			// Mark as error
			await ctx.runMutation(api.webhooks.markWebhookProcessed, {
				webhookId: args.webhookId,
				status: "error",
				errorMessage,
			});

			return { success: false, error: errorMessage };
		}
	},
});
