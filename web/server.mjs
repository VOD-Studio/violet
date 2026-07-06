/**
 * 生产 SSR 启动器（srvx/node）
 *
 * TanStack Start 的 vite build 产出 dist/server/server.js，
 * 导出一个 { fetch(Request): Response } handler，但不自带 HTTP 监听。
 * 用 srvx（@tanstack/start-plugin-core 的传递依赖，这里提升为直接依赖）
 * 做 node:http 桥接：内置 backpressure、body 大小限制、优雅退出、PORT=0 随机端口。
 *
 * 静态资源（dist/client/、/uploads）由前置 Nginx 处理，node 只负责 SSR 与 /api。
 *
 * 运行：node server.mjs（由 Dockerfile CMD 调用）
 * 监听端口由 PORT 环境变量控制（默认 3000），HOST 默认 0.0.0.0。
 */
import { serve } from "srvx/node";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const serverEntry = await import(join(__dirname, "dist/server/server.js"));
const handler = serverEntry.default;

if (!handler || typeof handler.fetch !== "function") {
    console.error("[server.mjs] dist/server/server.js 未导出 { fetch }，build 可能不完整");
    process.exit(1);
}

serve({
    fetch: handler.fetch,
    // port/hostname 不显式传：srvx 自动读 PORT/HOST 环境变量（默认 3000 / 0.0.0.0）
    // gracefulShutdown 默认开启（SIGINT/SIGTERM）
});
