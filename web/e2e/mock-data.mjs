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

const CONTRACT_POST = {
	id: "10000000-0000-0000-0000-000000000001",
	slug: "contract-post-1",
	title: "壳层契约文章 1",
	content_html: "<h2>首访缓存</h2><p>首访缓存回归正文始终可读。</p>",
	content_md: "",
	excerpt: "首访缓存回归正文。",
	cover_image: "",
	status: "published",
	author_id: "30000000-0000-0000-0000-000000000001",
	view_count: 7,
	is_featured: true,
	show_signature: false,
	seo_title: "",
	seo_description: "",
	tags: ["契约"],
	published_at: "2026-08-11T10:00:00Z",
	created_at: "2026-08-11T10:00:00Z",
	updated_at: "2026-08-11T10:00:00Z",
};

const RICH_CONTENT_POSTS = ["code", "diagram", "toc", "image", "toc-copy", "worker", "image-hydration"].map((kind, index) => ({
	...CONTRACT_POST,
	id: `10000000-0000-0000-0000-00000000001${index + 1}`,
	slug: `contract-rich-${kind}`,
	title: `富内容故障契约：${kind}`,
	...(kind === "image-hydration" ? { cover_image: "/uploads/contract-cover.png" } : {}),
	content_html: [
		"<h2>富内容局部恢复</h2>",
		"<p>增强加载失败时，这段正文始终保留。</p>",
		kind === "diagram"
			? '<div data-type="diagram-block" data-format="mermaid" data-source="flowchart LR\n  A[开始阅读] --&gt; B[完整图表]"></div>'
			: '<pre><code class="language-typescript">const recoveryMessage = "正文仍可阅读";</code></pre>',
		"<p>增强恢复后，这段结尾仍是原来的节点。</p>",
		kind === "image"
			? '<p><img src="/uploads/contract-article.png" alt="可预览的正文图片" width="400" height="240"></p>'
			: "",
		kind === "worker"
			? '<pre><code class="language-python">print("线程结果独立")</code></pre>'
			: "",
		kind === "image-hydration"
			? '<p><img src="/uploads/contract-small.png" alt="水合前小图"></p><p><img src="/uploads/contract-small.gif" alt="水合前动图"></p>'
			: "",
		kind === "toc" || kind === "toc-copy"
			? Array.from(
					{ length: 20 },
					(_, index) =>
						`<h2>目录章节 ${index + 1}</h2><p>键盘焦点保持可见，不被滚动区域裁剪。</p>`,
				).join("")
			: "",
	].join(""),
}));

const CONTRACT_NOTE = {
	id: "41000000-0000-0000-0000-000000000001",
	title: "缓存接管笔记",
	content_html: "<p>笔记内容在首访接管期间保持可读。</p>",
	tags: ["ssr"],
	published_at: "2026-08-11T10:00:00Z",
};

const CONTRACT_SERIES = {
	id: "42000000-0000-0000-0000-000000000001",
	slug: "contract-series",
	title: "缓存接管系列",
	description: "系列目录在首访接管期间保持可读。",
	cover_image: "",
	chapter_count: 1,
	latest_chapter_at: CONTRACT_POST.published_at,
	created_at: CONTRACT_POST.created_at,
	sections: [],
	root_chapters: [
		{
			post_id: CONTRACT_POST.id,
			slug: CONTRACT_POST.slug,
			title: CONTRACT_POST.title,
			chapter_no: 1,
			published_at: CONTRACT_POST.published_at,
		},
	],
};

const RICH_CONTENT_SERIES = {
	...CONTRACT_SERIES,
	id: "42000000-0000-0000-0000-000000000002",
	slug: "contract-rich-series",
	title: "富内容阅读交互",
	chapter_count: 3,
	root_chapters: RICH_CONTENT_POSTS.filter(
		(post) => post.slug === "contract-rich-toc" || post.slug === "contract-rich-toc-copy",
	).concat(RICH_CONTENT_POSTS.filter((post) => post.slug === "contract-rich-image")).map((post, index) => ({
		post_id: post.id,
		slug: post.slug,
		title: post.title,
		chapter_no: index + 1,
		published_at: post.published_at,
	})),
};

const envelope = (data) => JSON.stringify({ data });

const paged = (data, limit) =>
	JSON.stringify({
		data,
		meta: { pagination: { page: 1, limit, total: data.length, total_pages: 1 } },
	});

/** 沉浸方言契约用公开图集：单图集单图，图片本体由契约路由按 /assets 路径应答。 */
const CONTRACT_GALLERY = {
	id: "20000000-0000-0000-0000-000000000001",
	slug: "contract-gallery",
	title: "沉浸契约图集",
	summary: "用于沉浸方言视觉验收的样例图集。",
	published_at: "2026-08-01T10:00:00Z",
	items: [
		{
			file_id: "21000000-0000-0000-0000-000000000001",
			position: 1,
			thumbnail: "/assets/contract-image.png",
			url: "/assets/contract-image.png",
			width: 640,
			height: 420,
			alt_text: "契约样例图",
			caption: "",
		},
	],
};

/** 工具方言契约的后台操作者（permissions 通配，满足 admin:access 门禁）。 */
const ADMIN_USER = {
	id: "30000000-0000-0000-0000-000000000001",
	username: "contract",
	display_name: "Contract",
	email: "contract@local",
	avatar_url: "",
	cover_url: "",
	bio: "",
	role: "root",
	is_root: true,
	email_verified: true,
	is_active: true,
	created_at: "2026-01-01T00:00:00Z",
	has_password: true,
	permissions: ["*"],
};

const CONTRACT_POST_SUMMARY = (i) => ({
	id: `31000000-0000-0000-0000-00000000000${i}`,
	title: `契约文章 ${i}`,
	slug: `contract-post-${i}`,
	status: "published",
	view_count: i * 11,
	published_at: `2026-08-1${i}T10:00:00Z`,
});

/** 后台总览统计（GET /admin/stats）。 */
const ADMIN_STATS = {
	total_posts: 3,
	total_comments: 5,
	pending_comments: 1,
	pending_friend_links: 0,
	failing_subscriptions: 0,
	total_views: 4200,
	today_views: 32,
	yesterday_views: 28,
	week_comments: 2,
	last_week_comments: 3,
	total_users: 2,
	recent_posts: [1, 2, 3].map(CONTRACT_POST_SUMMARY),
	popular_posts: [3, 1].map(CONTRACT_POST_SUMMARY),
};

/** 浏览量趋势（GET /admin/stats/views）：30 个日聚合点 + 12 个月聚合点。 */
const ADMIN_VIEW_TRENDS = {
	daily: Array.from({ length: 30 }, (_, i) => ({
		label: `2026-08-${String(i + 1).padStart(2, "0")}`,
		count: 10 + ((i * 7) % 23),
	})),
	monthly: Array.from({ length: 12 }, (_, i) => ({
		label: `2026-${String(i + 1).padStart(2, "0")}`,
		count: 200 + i * 15,
	})),
};

/**
 * 项目路线图契约用数据：计划中 3、进行中 2、已完成 12 条（超过默认展开的 10 条）。
 * 条目顺序同后端：计划中与进行中按位置，已完成按完成日期倒序（同日按编号倒序）。
 */
const ROADMAP_PROJECT = {
	id: "40000000-0000-0000-0000-000000000001",
	title: "路线图契约项目",
	slug: "roadmap-contract",
	description: "用于项目详情页验收的样例项目。",
	url: "https://example.com/demo",
	github_url: "https://github.com/example/roadmap-contract",
	image_url: "",
	tech_stack: ["Go", "React", "PostgreSQL"],
	sort_order: 1,
	created_at: "2026-08-01T00:00:00Z",
};

const roadmapItem = (number, stage, overrides = {}) => ({
	id: `41000000-0000-0000-0000-${String(number).padStart(12, "0")}`,
	project_id: ROADMAP_PROJECT.id,
	number,
	title: `条目 ${number}`,
	description: "",
	stage,
	position: `a${String(number).padStart(3, "0")}`,
	tags: [],
	links: [],
	checklist: [],
	completion_date: null,
	delivered_version: "",
	blocked: false,
	created_at: "2026-09-01T00:00:00Z",
	updated_at: "2026-09-01T00:00:00Z",
	...overrides,
});

const ROADMAP_ITEMS = [
	roadmapItem(1, "planned", {
		title: "计划中的第一项",
		description: "第一行说明\n第二行说明",
		tags: ["性能", "画布", "文档", "测试", "发布"],
		links: [{ label: "设计稿", url: "https://example.com/design" }],
		checklist: [
			{ text: "梳理现有画布的交互", done: true },
			{ text: "补键盘操作", done: false },
			{ text: "补读屏说明", done: false },
		],
	}),
	// 被进行中的第一项阻塞（见下面的关系）：后端据此派生 blocked
	roadmapItem(2, "planned", { title: "计划中的第二项", blocked: true }),
	roadmapItem(3, "planned", { title: "计划中的第三项" }),
	// 子项很多：卡片只显示进度，弹窗里清单在区域内滚动并可只看未完成的
	roadmapItem(4, "in_progress", {
		title: "进行中的第一项",
		tags: ["后端"],
		checklist: Array.from({ length: 30 }, (_, index) => ({
			text: `第 ${index + 1} 步：${index % 7 === 0 ? "这一步的说明比较长，需要在清单里自然换行而不是撑破弹窗的宽度，也不能把后面的步骤挤到看不见的地方" : "处理一小块"}`,
			done: index < 12,
		})),
	}),
	roadmapItem(5, "in_progress", { title: "进行中的第二项" }),
	...Array.from({ length: 12 }, (_, index) => {
		const number = 17 - index;
		return roadmapItem(number, "completed", {
			title: `已完成的第 ${number} 项`,
			completion_date: `2026-10-${String(20 - index).padStart(2, "0")}`,
			delivered_version: `v2.${number}.0`,
			...(number === 17
				? {
					description: "完成后的复盘说明",
					tags: ["复盘"],
					links: [
						{ label: "发布说明", url: "https://example.com/release" },
						{ label: "", url: "https://example.com/no-label" },
					],
				}
				: {}),
		});
	}),
];

const itemId = (number) => `41000000-0000-0000-0000-${String(number).padStart(12, "0")}`;

const roadmapRelation = (source, target, type) => ({
	id: `42000000-0000-0000-0000-${String(source).padStart(6, "0")}${String(target).padStart(6, "0")}`,
	project_id: ROADMAP_PROJECT.id,
	source_id: itemId(source),
	target_id: itemId(target),
	type,
	created_at: "2026-09-02T00:00:00Z",
});

/**
 * 关系覆盖三种线型与跨列、同列两种走线：#4 阻塞 #2（跨列），#4 扩展 #1（跨列），
 * #3 扩展 #1（同列），#17 修复 #16（同列）。
 */
const ROADMAP_RELATIONS = [
	roadmapRelation(4, 2, "blocks"),
	roadmapRelation(4, 1, "extends"),
	roadmapRelation(3, 1, "extends"),
	roadmapRelation(17, 16, "fixes"),
];

/** 路线图详情（GET /projects/by-slug/{slug}/roadmap）；可导出供契约 spec 引用条目。 */
export const ROADMAP_FIXTURE = {
	project: ROADMAP_PROJECT,
	items: ROADMAP_ITEMS,
	relations: ROADMAP_RELATIONS,
	progress: { planned: 3, in_progress: 2, completed: 12, total: 17, percent: 71 },
};

const ROADMAP_EMPTY = {
	project: { ...ROADMAP_PROJECT, id: "40000000-0000-0000-0000-000000000002", slug: "roadmap-empty", title: "空路线图项目" },
	items: [],
	relations: [],
	progress: { planned: 0, in_progress: 0, completed: 0, total: 0, percent: 0 },
};

const ROADMAPS = { "roadmap-contract": ROADMAP_FIXTURE, "roadmap-empty": ROADMAP_EMPTY };

const roadmapFence = (config) =>
	`<pre><code class="language-roadmap">${JSON.stringify(config)}</code></pre>`;

/** 文章嵌入契约用文章：条目卡片、项目卡片与不存在的条目各一张。 */
export const ROADMAP_EMBED_POST = {
	id: "32000000-0000-0000-0000-000000000001",
	title: "路线图嵌入契约文章",
	slug: "roadmap-embeds",
	content_md: "",
	content_html: [
		"<p>文章开头的一段话。</p>",
		roadmapFence({ project: "roadmap-contract", item: 2, display: "card" }),
		"<p>中间的一段话。</p>",
		roadmapFence({ project: "roadmap-contract", display: "card" }),
		roadmapFence({ project: "roadmap-contract", item: 99 }),
		"<p>文章结尾的一段话。</p>",
	].join(""),
	excerpt: "",
	cover_image: "",
	status: "published",
	author_id: "30000000-0000-0000-0000-000000000001",
	view_count: 1,
	is_featured: false,
	show_signature: false,
	seo_title: "",
	seo_description: "",
	published_at: "2026-10-18T10:00:00Z",
	created_at: "2026-10-18T10:00:00Z",
	updated_at: "2026-10-18T10:00:00Z",
	tags: [],
};

/** 画布嵌入契约用文章：看板画布、整个项目的关系图与以 #1 为根的关系图。 */
export const ROADMAP_CANVAS_POST = {
	...ROADMAP_EMBED_POST,
	id: "32000000-0000-0000-0000-000000000002",
	title: "路线图画布契约文章",
	slug: "roadmap-canvas-embeds",
	content_html: [
		"<p>画布之前的一段话。</p>",
		roadmapFence({ project: "roadmap-contract", display: "canvas" }),
		roadmapFence({ project: "roadmap-contract", display: "canvas", view: "graph" }),
		roadmapFence({ project: "roadmap-contract", display: "canvas", view: "graph", item: 1 }),
		`<p>${"画布之后的长段落，用来让页面可以滚动。".repeat(60)}</p>`,
	].join(""),
};

const summarize = (progress, inProgress, latestCompleted) => ({
	progress,
	in_progress: inProgress,
	latest_completed: latestCompleted,
});

/**
 * 项目列表契约用数据（GET /projects）。顺序是站主设定的展示顺序，故意既不按标题也不按时间排：
 * 路线图契约项目有完整摘要与可用封面；Zeta 工具封面失效、没有进行中与已完成；
 * 空路线图项目有摘要但没有条目；Alpha 读不到摘要。
 */
export const PROJECTS_FIXTURE = [
	{
		...ROADMAP_PROJECT,
		image_url: "/assets/contract-cover.png",
		created_at: "2026-08-01T00:00:00Z",
		roadmap: summarize(
			ROADMAP_FIXTURE.progress,
			ROADMAP_ITEMS.filter((item) => item.stage === "in_progress").map((item) => ({
				id: item.id,
				number: item.number,
				title: item.title,
				completion_date: null,
			})),
			{
				id: ROADMAP_ITEMS[5].id,
				number: ROADMAP_ITEMS[5].number,
				title: ROADMAP_ITEMS[5].title,
				completion_date: ROADMAP_ITEMS[5].completion_date,
			},
		),
	},
	{
		id: "40000000-0000-0000-0000-000000000003",
		title: "Zeta 工具",
		slug: "zeta-tool",
		description: "封面失效的项目，只有计划中的条目。",
		url: "",
		github_url: "",
		image_url: "/uploads/missing-cover.png",
		tech_stack: ["TypeScript"],
		sort_order: 2,
		created_at: "2026-09-01T00:00:00Z",
		roadmap: summarize({ planned: 2, in_progress: 0, completed: 0, total: 2, percent: 0 }, [], null),
	},
	{
		...ROADMAP_EMPTY.project,
		image_url: "",
		sort_order: 3,
		created_at: "2026-07-01T00:00:00Z",
		roadmap: summarize({ planned: 0, in_progress: 0, completed: 0, total: 0, percent: 0 }, [], null),
	},
	{
		id: "40000000-0000-0000-0000-000000000004",
		title: "Alpha 无摘要",
		slug: "alpha",
		description: "后端没有附带路线图摘要的项目。",
		url: "",
		github_url: "",
		image_url: "",
		tech_stack: [],
		sort_order: 4,
		created_at: "2026-10-01T00:00:00Z",
	},
];

/** 与后端 envelope 语义一致的路由表；浏览器侧 page.route 复用同一份数据。
 * cookie 含 contract_admin=1 时按已登录 root 应答会话与后台数据（工具方言契约用）。 */
export function handle(method, pathname, search, cookie = "") {
	const params = new URLSearchParams(search || "");
	const isAdminActor = /(?:^|;\s*)contract_admin=1(?:;|$)/.test(cookie);
	if (
		method === "POST" &&
		RICH_CONTENT_POSTS.some((post) => pathname === `/api/v1/posts/${post.id}/view`)
	) {
		return { status: 200, body: envelope(null) };
	}
	if (method !== "GET") return { status: 405, body: JSON.stringify({ error: "METHOD_NOT_ALLOWED" }) };
	if (pathname === "/api/v1/emojis") return { status: 200, body: envelope([]) };
	if (pathname === "/api/v1/site-identity") return { status: 200, body: envelope(SITE_IDENTITY) };
	if (pathname === "/api/v1/music/playback") return { status: 200, body: envelope({ mode: "anonymous" }) };
	if (pathname === "/api/v1/music/playlists") return { status: 200, body: envelope([]) };
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
			published_at: `2026-08-1${i + 1}T10:00:00Z`,
			tags: ["契约"],
			is_featured: i === 0,
		}));
		return { status: 200, body: paged(posts, limit) };
	}
	if (pathname === "/api/v1/posts/contract-post-1") {
		return { status: 200, body: envelope(CONTRACT_POST) };
	}
	const richContentPost = RICH_CONTENT_POSTS.find(
		(post) => pathname === `/api/v1/posts/${post.slug}`,
	);
	if (richContentPost) return { status: 200, body: envelope(richContentPost) };
	if (
		RICH_CONTENT_POSTS.some(
			(post) => pathname === `/api/v1/posts/${post.id}/annotations/summary`,
		)
	) {
		return { status: 200, body: envelope([]) };
	}
	if (
		RICH_CONTENT_POSTS.some((post) => pathname === `/api/v1/posts/${post.id}/comments`)
	) {
		return { status: 200, body: paged([], Number(params.get("limit") || 20)) };
	}
	const richChapterIndex = RICH_CONTENT_SERIES.root_chapters.findIndex(
		(chapter) => pathname === `/api/v1/series/context/${chapter.slug}`,
	);
	if (richChapterIndex >= 0) {
		const navigation = (chapter) =>
			chapter ? { slug: chapter.slug, title: chapter.title } : null;
		return {
			status: 200,
			body: envelope({
				series: { slug: RICH_CONTENT_SERIES.slug, title: RICH_CONTENT_SERIES.title },
				chapter_no: richChapterIndex + 1,
				total_chapters: RICH_CONTENT_SERIES.chapter_count,
				prev_chapter: navigation(RICH_CONTENT_SERIES.root_chapters[richChapterIndex - 1]),
				next_chapter: navigation(RICH_CONTENT_SERIES.root_chapters[richChapterIndex + 1]),
			}),
		};
	}
	if (
		RICH_CONTENT_POSTS.some(
			(post) => pathname === `/api/v1/series/context/${post.slug}`,
		)
	) {
		return { status: 200, body: envelope(null) };
	}
	if (
		pathname === `/api/v1/posts/${CONTRACT_POST.id}/annotations/summary` ||
		pathname === `/api/v1/posts/${ROADMAP_EMBED_POST.id}/annotations/summary` ||
		pathname === `/api/v1/posts/${ROADMAP_CANVAS_POST.id}/annotations/summary`
	) {
		return { status: 200, body: envelope([]) };
	}
	if (pathname === "/api/v1/series/context/contract-post-1") {
		return { status: 200, body: envelope(null) };
	}
	if (pathname === "/api/v1/notes") {
		const tag = params.get("tag");
		const notes = !tag || CONTRACT_NOTE.tags.includes(tag) ? [CONTRACT_NOTE] : [];
		return { status: 200, body: paged(notes, Number(params.get("limit") || 24)) };
	}
	if (pathname === `/api/v1/notes/${CONTRACT_NOTE.id}`) {
		return { status: 200, body: envelope(CONTRACT_NOTE) };
	}
	if (pathname === "/api/v1/series/contract-rich-series") {
		return { status: 200, body: envelope(RICH_CONTENT_SERIES) };
	}
	if (pathname === "/api/v1/series/contract-series") {
		return { status: 200, body: envelope(CONTRACT_SERIES) };
	}
	if (pathname === "/api/v1/auth/session") {
		if (!isAdminActor) {
			return { status: 401, body: JSON.stringify({ error: "UNAUTHORIZED", message: "未登录" }) };
		}
		return {
			status: 200,
			body: envelope({
				user_id: "30000000-0000-0000-0000-000000000001",
				role: "root",
				email: "contract@local",
				is_root: true,
			}),
		};
	}
	if (pathname === "/api/v1/auth/me") {
		if (!isAdminActor) {
			return { status: 401, body: JSON.stringify({ error: "UNAUTHORIZED", message: "未登录" }) };
		}
		return { status: 200, body: envelope(ADMIN_USER) };
	}
	if (pathname === "/api/v1/admin/stats") {
		return { status: 200, body: envelope(ADMIN_STATS) };
	}
	if (pathname === "/api/v1/admin/stats/views") {
		return { status: 200, body: envelope(ADMIN_VIEW_TRENDS) };
	}
	if (pathname === "/api/v1/admin/logs") {
		return { status: 200, body: paged([], 20) };
	}
	if (pathname === "/api/v1/persona") return { status: 200, body: envelope(null) };
	if (pathname === "/api/v1/tweets") {
		const limit = Number(params.get("limit") || 20);
		return { status: 200, body: paged([], limit) };
	}
	if (pathname === "/api/v1/settings") {
		return {
			status: 200,
			body: envelope({
				site_name: "Violet",
				github_username: "contract",
				profile_role: "缓存接管契约作者",
				avatar_url: "",
				tagline: "",
				about_config: {
					sections: [{ id: "bio", enabled: true }],
				},
			}),
		};
	}
	if (pathname === "/api/v1/announcements") return { status: 200, body: envelope([]) };
	if (pathname === "/api/v1/projects") return { status: 200, body: envelope(PROJECTS_FIXTURE) };
	if (pathname === `/api/v1/posts/${ROADMAP_CANVAS_POST.slug}`)
		return { status: 200, body: envelope(ROADMAP_CANVAS_POST) };
	if (pathname === `/api/v1/posts/${ROADMAP_EMBED_POST.slug}`)
		return { status: 200, body: envelope(ROADMAP_EMBED_POST) };
	const roadmap = /^\/api\/v1\/projects\/by-slug\/([^/]+)\/roadmap$/.exec(pathname);
	if (roadmap) {
		const detail = ROADMAPS[decodeURIComponent(roadmap[1])];
		return detail
			? { status: 200, body: envelope(detail) }
			: { status: 404, body: JSON.stringify({ error: "NOT_FOUND", message: "项目不存在" }) };
	}
	if (pathname === "/api/v1/galleries") {
		const limit = Number(params.get("limit") || 12);
		return { status: 200, body: paged([CONTRACT_GALLERY], limit) };
	}
	if (pathname === "/api/v1/galleries/contract-gallery") {
		return { status: 200, body: envelope(CONTRACT_GALLERY) };
	}
	return { status: 404, body: JSON.stringify({ error: "NOT_FOUND", message: pathname }) };
}

