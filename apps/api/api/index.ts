import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createServer } from "../src/server.js";
import { loadConfig } from "../src/config.js";

const config = loadConfig();
const app = createServer(config);
const ready = app.ready();

export default async function handler(req: VercelRequest, res: VercelResponse) {
	await ready;
	app.server.emit("request", req, res);
}

