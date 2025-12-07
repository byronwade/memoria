import http from "node:http";

export function createServer() {
	return http.createServer((req, res) => {
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ status: "ok", service: "memoria-api" }));
	});
}

export function start(port = Number(process.env.PORT) || 3000) {
	const server = createServer();
	server.listen(port, () => {
		console.log(`Memoria API listening on http://localhost:${port}`);
	});
	return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
	start();
}
