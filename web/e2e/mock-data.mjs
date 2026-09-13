/**
 * 主题浏览器契约的 mock API 数据与路由表（无 HTTP 监听，供服务端与浏览器契约共用）。
 *
 * 服务端（mock-api.mjs）与浏览器契约（theme-contract.spec.ts 的 page.route）
 * 共用同一份 envelope 路由表，保证 SSR loader 与浏览器侧请求看到相同数据。
 */

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
	if (pathname === "/api/v1/posts") {
		const limit = Number(params.get("limit") || 12);
		const posts = Array.from({ length: Math.min(limit, 6) }, (_, i) => ({
			id: `10000000-0000-0000-0000-00000000000${i + 1}`,
			slug: `contract-post-${i + 1}`,
			title: `壳层契约文章 ${i + 1}`,
			excerpt: "用于公开壳层视觉验收的样例摘要。",
			cover_image: "",
			view_count: i * 7,
			published_at: "2026-08-1" + ((i % 9) + 1) + "T10:00:00Z",
			tags: ["契约"],
			is_featured: i === 0,
		}));
		return { status: 200, body: paged(posts, limit) };
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

