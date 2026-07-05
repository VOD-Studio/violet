/**
 * 生产 SSR 启动器（node:http wrapper）
 *
 * TanStack Start 1.168 的 vite build 产出 dist/server/server.js，
 * 它导出一个 H3 风格的 { fetch(Request): Response } handler，但不自带 HTTP 监听。
 * 本文件用 node:http 创建 HTTP server，把每个进来的请求转成 Web Request 交给 handler，
 * 再把 Response 写回客户端。
 *
 * 设计参考 TanStack Start 官方「ditching adapters」理念：
 * Nitro/h3 维护底层适配器，这里只做最薄的 node:http → Web fetch 桥接。
 *
 * 运行：node server.mjs（由 Dockerfile CMD 调用）
 * 监听端口由 PORT 环境变量控制（默认 3000），HOST 默认 0.0.0.0。
 */

import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, stat } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

// vite build 产出的客户端静态资源目录
const CLIENT_DIR = join(__dirname, "dist/client");

// 静态资源 MIME 映射（按需补充）
const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".eot": "application/vnd.ms-fontobject",
    ".wasm": "application/wasm",
    ".txt": "text/plain; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".worker.js": "text/javascript; charset=utf-8",
};

/**
 * tryServeStatic - 尝试从 dist/client 提供静态文件
 *
 * vite build 的资源引用路径如 /assets/xxx.js、/pdf.worker.min.mjs，
 * 对应文件在 dist/client/assets/、dist/client/pdf.worker.min.mjs。
 * 命中返回 true 并已写回响应，未命中返回 false 交由 SSR handler 处理。
 */
async function tryServeStatic(req, res, urlPath) {
    // 只处理看起来像静态资源的请求（含扩展名或 /assets/ 前缀）
    if (!/\.[a-zA-Z0-9]+$/.test(urlPath) && !urlPath.startsWith("/assets/")) {
        return false;
    }
    const filePath = join(CLIENT_DIR, urlPath);
    // 防 path traversal
    if (!filePath.startsWith(CLIENT_DIR)) return false;
    try {
        const s = await stat(filePath);
        if (!s.isFile()) return false;
        const data = await readFile(filePath);
        const ext = urlPath.match(/\.[a-zA-Z0-9]+$/)?.[0] || "";
        const mime = MIME[ext] || "application/octet-stream";
        res.writeHead(200, {
            "content-type": mime,
            "content-length": data.length,
            // 带 hash 的资源名永久缓存，其他资源不缓存
            "cache-control": /-[A-Za-z0-9_-]{8,}\./.test(urlPath)
                ? "public, max-age=31536000, immutable"
                : "no-cache",
        });
        res.end(data);
        return true;
    } catch {
        return false;
    }
}

// 动态 import vite build 产出的 server entry（export default { fetch }）
const serverEntry = await import(join(__dirname, "dist/server/server.js"));
const handler = serverEntry.default;

if (!handler || typeof handler.fetch !== "function") {
    console.error("[server.mjs] dist/server/server.js 未导出 { fetch }，build 可能不完整");
    process.exit(1);
}

const server = createServer(async (req, res) => {
    try {
        const urlPath = req.url.split("?")[0];

        // 1. 优先尝试静态资源（dist/client/）
        if (await tryServeStatic(req, res, urlPath)) return;

        // 2. 否则交给 SSR handler
        // 把 node:http 的 req 构造成标准 Web Request
        const protocol = req.headers["x-forwarded-proto"] === "https" ? "https:" : "http:";
        const host = req.headers.host || `${HOST}:${PORT}`;
        const url = `${protocol}//${host}${req.url}`;

        // 聚合请求体（POST/PUT 等）
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

        const request = new Request(url, {
            method: req.method,
            headers: req.headers,
            body: ["GET", "HEAD"].includes(req.method) ? undefined : body,
            // H3 内部用 duplex stream 处理 body
            duplex: "half",
        });

        // 调用 TanStack Start handler
        const response = await handler.fetch(request);

        // 写响应头
        const headers = {};
        response.headers.forEach((value, key) => {
            headers[key] = value;
        });
        res.writeHead(response.status, headers);

        // 写响应体
        if (response.body) {
            const reader = response.body.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(value);
            }
        }
        res.end();
    } catch (err) {
        console.error("[server.mjs] 请求处理失败:", err);
        if (!res.headersSent) {
            res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
        }
        res.end(JSON.stringify({ error: "SSR server error" }));
    }
});

server.listen(PORT, HOST, () => {
    console.log(`[server.mjs] SSR server listening on http://${HOST}:${PORT}`);
});

// 优雅退出
for (const sig of ["SIGTERM", "SIGINT"]) {
    process.on(sig, () => {
        console.log(`[server.mjs] 收到 ${sig}，关闭 server`);
        server.close(() => process.exit(0));
    });
}
