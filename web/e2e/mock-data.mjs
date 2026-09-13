/**
 * 主题浏览器契约的 mock API 数据与路由表（无 HTTP 监听，供服务端与浏览器契约共用）。
 *
 * 职责只有两个：
 * 1. SSR：`node server.mjs` 按运行时环境变量 VITE_SSR_API_BASE_URL 直连本服务，
 *    保证首页 loader（site-identity）成功、真实 SSR 首帧成立。
 * 2. 浏览器：契约 spec 通过 page.route 读取本模块导出的 HANDLERS 语义
 *    （见 theme-contract.spec.ts 内的 mockFetch），拦截同源 /api/v1/* 请求。
 *
 * 端口取 PORT 环境变量（默认 9410），刻意避开本地开发后端的 9090，
 * 使契约可与 make dev 并存。
 */
import { createServer } from "node:http";

const PORT = Number(process.env.PORT || 9410);

/** 首页 loader 必需的站点身份（含卷首引言，驱动 Epigraph 渲染）。 */
const SITE_IDENTITY = {
	site_name: "Violet",
	site_url: "https://contract.local",
	owner_name: "contract",
	bio: "主题契约测试站点。",
	avatar_url: "",
	location: "",
	hero: {
		banner_url: null,
		quote: "We can only see a short distance ahead, but we can see plenty there that needs to be done.",
		quote_translation: "「我们只能看清眼前的一小段路，但已足以看清有无数的事亟待完成。」",
		quote_author: "Alan Turing",
	},
	social_links: [],
	subscription_channels: [{ kind: "rss", label: "RSS", href: "/feed.xml" }],
	home: {
		footprint_enabled: false,
		footprint_aggregation_days: 7,
	},
};

const PUBLICATIONS = [1, 2, 3].map((i) => ({
	id: `00000000-0000-0000-0000-00000000000${i}`,
	kind: "article",
	route_key: `contract-post-${i}`,
	title: `契约样例文章 ${i}`,
	published_at: "2026-08-0" + i + "T10:00:00Z",
	featured: i === 1,
}));

const envelope = (data) => JSON.stringify({ data });

const paged = (data, limit) =>
	JSON.stringify({
		data,
		meta: { pagination: { page: 1, limit, total: data.length, total_pages: 1 } },
	});

/** 与后端 envelope 语义一致的只读路由表；浏览器侧 page.route 复用同一份数据。 */
export function handle(method, pathname, search) {
	const params = new URLSearchParams(search || "");
	if (method !== "GET") return { status: 405, body: JSON.stringify({ error: "METHOD_NOT_ALLOWED" }) };
	if (pathname === "/api/v1/site-identity") return { status: 200, body: envelope(SITE_IDENTITY) };
	if (pathname === "/api/v1/publications") {
		const limit = Number(params.get("limit") || 5);
		return { status: 200, body: paged(PUBLICATIONS.slice(0, limit), limit) };
	}
	if (pathname === "/api/v1/auth/session") {
		return { status: 401, body: JSON.stringify({ error: "UNAUTHORIZED", message: "未登录" }) };
	}
	if (pathname === "/api/v1/persona") return { status: 200, body: envelope(null) };
	if (pathname === "/api/v1/tweets") {
		const limit = Number(params.get("limit") || 20);
		return { status: 200, body: paged([], limit) };
	}
	if (pathname === "/api/v1/settings") return { status: 200, body: envelope({}) };
	if (pathname === "/api/v1/announcements") return { status: 200, body: envelope([]) };
	return { status: 404, body: JSON.stringify({ error: "NOT_FOUND", message: pathname }) };
}

