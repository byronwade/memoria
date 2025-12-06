import { z } from "zod";

const envSchema = z.object({
	PORT: z.coerce.number().default(3000),
	CONVEX_URL: z.string().url().optional(),
	CONVEX_ADMIN_KEY: z.string().optional(),
	STRIPE_WEBHOOK_SECRET: z.string().optional(),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
	return envSchema.parse(env);
}

