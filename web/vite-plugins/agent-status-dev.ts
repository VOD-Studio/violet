import { existsSync, readFileSync, unwatchFile, watchFile } from "node:fs";
import type { ServerResponse } from "node:http";
import type { Plugin, ViteDevServer } from "vite";

const ENDPOINT = "/api/dev/agent-status";
/** 轮询间隔:容器 bind mount 下 fs 事件不可靠,watchFile 轮询兜底 */
const POLL_INTERVAL_MS = 500;
/** SSE 心跳:防中间层掐空闲连接(本地直连场景仍保留,对齐通用实践) */
const HEARTBEAT_MS = 25_000;

function readStatusFile(file: string): string | null {
	try {
		return existsSync(file) ? readFileSync(file, "utf8").trim() : null;
	} catch {
		return null;
	}
}

/**
 * dev 汇聚端:watch 状态文件(web/.agent-status.json,适配器单写者 JSON)
 * → SSE endpoint /api/dev/agent-status。仅 dev server 生效,不进生产路由;
 * 内容透传不判别——协议校验在浏览器端 transport 层(isAgentStatusMessage)。
 */
export function agentStatusDevPlugin(root: string): Plugin {
	const statusFile = `${root}/.agent-status.json`;
	return {
		name: "violet:agent-status-dev",
		apply: "serve",
		configureServer(server: ViteDevServer) {
			const clients = new Set<ServerResponse>();
			let lastRaw: string | null = readStatusFile(statusFile);

			const push = (res: ServerResponse, raw: string) => {
				res.write(`data: ${raw}\n\n`);
			};
			const broadcast = () => {
				if (!lastRaw) return;
				for (const res of clients) push(res, lastRaw);
			};

			watchFile(statusFile, { interval: POLL_INTERVAL_MS }, () => {
				const raw = readStatusFile(statusFile);
				if (raw !== null && raw !== lastRaw) {
					lastRaw = raw;
					broadcast();
				}
			});

			const heartbeat = setInterval(() => {
				for (const res of clients) res.write(": ping\n\n");
			}, HEARTBEAT_MS);

			server.middlewares.use(ENDPOINT, (req, res) => {
				res.writeHead(200, {
					"Content-Type": "text/event-stream",
					"Cache-Control": "no-cache",
					Connection: "keep-alive",
				});
				// 连接即推当前快照:重连方恢复最新状态,旧消息由消费端 seq 去重
				if (lastRaw) push(res, lastRaw);
				clients.add(res);
				req.on("close", () => {
					clients.delete(res);
				});
			});

			server.httpServer?.on("close", () => {
				clearInterval(heartbeat);
				unwatchFile(statusFile);
				for (const res of clients) res.end();
				clients.clear();
			});
		},
	};
}
