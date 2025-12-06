import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import rawBody from "fastify-raw-body";
import Stripe from "stripe";
import { loadConfig, type AppConfig } from "./config.js";
import { createConvexClient, type ConvexClient } from "./convexClient.js";

type RawBodyRequest = FastifyRequest & { rawBody?: Buffer };

function requireConvex(convex: ConvexClient, reply: FastifyReply) {
	if (convex.isEnabled()) return true;
	reply.code(503).send({ error: "convex_unconfigured" });
	return false;
}

function registerRoutes(app: FastifyInstance, convex: ConvexClient, config: AppConfig) {
	app.get("/health", async () => ({ status: "ok", service: "memoria-api" }));

	app.get<{
		Params: { userId: string };
	}>("/users/:userId", async (request, reply) => {
		if (!requireConvex(convex, reply)) return;
		const user = await convex.query("auth:getUserById", { userId: request.params.userId });
		if (!user) {
			reply.code(404).send({ error: "user_not_found" });
			return;
		}
		return user;
	});

	app.get<{
		Params: { userId: string };
		Querystring: { active?: string };
	}>("/users/:userId/repos", async (request, reply) => {
		if (!requireConvex(convex, reply)) return;
		const repos = (await convex.query("scm:getRepositories", {
			userId: request.params.userId,
		})) as { isActive: boolean }[];
		// Filter to active if requested
		const onlyActive = request.query.active === "true";
		const filteredRepos = onlyActive ? repos.filter((r) => r.isActive) : repos;
		return { repos: filteredRepos };
	});

	app.post("/webhooks/github", async (request, reply) => {
		if (!requireConvex(convex, reply)) return;
		const eventId =
			(request.headers["x-github-delivery"] as string | undefined) ??
			(request.headers["x-request-id"] as string | undefined) ??
			"unknown";
		const eventType = (request.headers["x-github-event"] as string | undefined) ?? "unknown";
		await convex.mutation("webhooks:storeInboundWebhook", {
			source: "github",
			externalEventId: eventId,
			eventType,
			payload: request.body ?? {},
		});
		reply.code(202).send({ status: "accepted" });
	});

	app.post("/webhooks/gitlab", async (request, reply) => {
		if (!requireConvex(convex, reply)) return;
		const eventId =
			(request.headers["x-gitlab-event-uuid"] as string | undefined) ??
			(request.headers["x-request-id"] as string | undefined) ??
			"unknown";
		const eventType = (request.headers["x-gitlab-event"] as string | undefined) ?? "unknown";
		await convex.mutation("webhooks:storeInboundWebhook", {
			source: "gitlab",
			externalEventId: eventId,
			eventType,
			payload: request.body ?? {},
		});
		reply.code(202).send({ status: "accepted" });
	});

	app.post("/webhooks/stripe", async (request, reply) => {
		if (!requireConvex(convex, reply)) return;
		const sig = request.headers["stripe-signature"] as string | undefined;
		const secret = config.STRIPE_WEBHOOK_SECRET;
		const raw = (request as RawBodyRequest).rawBody;

		let payload = request.body;
		if (sig && secret && raw) {
			try {
				payload = Stripe.webhooks.constructEvent(raw.toString(), sig, secret);
			} catch (error) {
				app.log.error({ err: error }, "Stripe signature validation failed");
				reply.code(400).send({ error: "invalid_signature" });
				return;
			}
		}

		const eventId = typeof payload === "object" && payload && "id" in payload ? (payload as { id: string }).id : "unknown";
		const eventType =
			typeof payload === "object" && payload && "type" in payload ? (payload as { type?: string }).type ?? "unknown" : "unknown";

		await convex.mutation("webhooks:storeInboundWebhook", {
			source: "stripe",
			externalEventId: eventId,
			eventType,
			payload,
		});

		reply.code(202).send({ status: "accepted" });
	});
}

export function createServer(config: AppConfig = loadConfig()) {
	const app = Fastify({ logger: true });

	app.register(rawBody, {
		field: "rawBody",
		global: false,
		routes: ["/webhooks/stripe"],
		runFirst: true,
	});

	const convex = createConvexClient(config);
	registerRoutes(app, convex, config);

	return app;
}

export async function start(port: number = Number(process.env.PORT) || 3000, config: AppConfig = loadConfig()) {
	const app = createServer(config);
	await app.listen({ port, host: "0.0.0.0" });
	return app;
}

