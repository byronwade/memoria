import { createServer, start as startServer } from "./server.js";
import { loadConfig } from "./config.js";

export { createServer };

export async function start(port = Number(process.env.PORT) || 3000) {
	const config = loadConfig();
	return startServer(port, config);
}

if (import.meta.url === `file://${process.argv[1]}`) {
	start().catch((error) => {
		console.error("Failed to start Memoria API", error);
		process.exitCode = 1;
	});
}
