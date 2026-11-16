import type { PostBrowseFilter } from "@entities/post/model/types";

/** 路径表达内容视图，筛选与分页保留在查询参数中。 */
export const BLOG_VIEW_PATHS = {
	posts: "/blog",
	series: "/blog/series",
	archive: "/blog/archive",
} as const;

/** 系列目录固定页尺寸，服务端预取与客户端订阅共用。 */
export const BLOG_SERIES_PAGE_SIZE = 24;

export type BlogView = keyof typeof BLOG_VIEW_PATHS;

/** 可分享的筛选与页码；缺省项不写入 URL。 */
export interface BlogSearch extends PostBrowseFilter {
	/** 从 1 开始；归档按年浏览，不用页码切片。 */
	page?: number;
}

/** 将外部查询参数收敛为筛选与分页，非法值回落到默认状态。 */
export function parseBlogSearch(search: Record<string, unknown>): BlogSearch {
	const rawPage =
		typeof search.page === "string" && /^\d+$/.test(search.page)
			? Number(search.page)
			: search.page;
	return {
		tag: typeof search.tag === "string" ? search.tag.trim() || undefined : undefined,
		source:
			search.source === "original" || search.source === "repost" ? search.source : undefined,
		page:
			typeof rawPage === "number" && Number.isSafeInteger(rawPage) && rawPage > 1
				? rawPage
				: undefined,
	};
}

/** 生成当前有效视图的相对地址，不包含追踪参数和默认值。 */
export function blogHref(view: BlogView, search: BlogSearch): string {
	const params = new URLSearchParams();
	if (search.tag) params.set("tag", search.tag);
	if (search.source) params.set("source", search.source);
	if (view !== "archive" && search.page && search.page > 1)
		params.set("page", String(search.page));
	return `${BLOG_VIEW_PATHS[view]}${params.size ? `?${params}` : ""}`;
}
