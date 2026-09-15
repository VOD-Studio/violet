/**
 * 主题浏览器契约的 mock API 服务端（node:http，无外部依赖）。
 *
 * `node server.mjs` 按运行时环境变量 VITE_SSR_API_BASE_URL 直连本服务，
 * 保证首页 loader（site-identity）成功、真实 SSR 首帧成立。
 * 端口默认 9410，避开本地开发后端的 9090，使契约可与 make dev 并存。
 */
import { createServer } from "node:http";
import { handle } from "./mock-data.mjs";

const PORT = Number(process.env.PORT || 9410);

createServer((req, res) => {
	const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
	const result = handle(req.method, url.pathname, url.search, req.headers.cookie ?? "");
	res.writeHead(result.status, {
		"content-type": "application/json; charset=utf-8",
		"access-control-allow-origin": "*",
	});
	res.end(result.body);
}).listen(PORT, "127.0.0.1", () => {
	console.log(`[mock-api] listening on http://127.0.0.1:${PORT}`);
});
