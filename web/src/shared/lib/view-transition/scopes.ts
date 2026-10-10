/**
 * 共享元素 morph 的范围登记：每一项是「来源页与目标页」的路由模式集合。
 *
 * 一个共享元素只会在范围内的两个路由之间 morph；点击登记的意图在导航离开范围时清除。
 * 新增一对 morph 页面时在这里登记范围，再在两端放 SharedElement、在来源链接上调用 markSharedSource。
 */

/** 博客列表卡片封面 ↔ 文章详情封面。 */
export const BLOG_SCOPE = ["/blog", "/blog/$slug"] as const;

/** 系列书架书封 ↔ 系列详情书封。 */
export const SERIES_SCOPE = ["/series", "/series/$slug"] as const;

/** 图集卡片封面 ↔ 图集详情封面。 */
export const GALLERY_SCOPE = ["/galleries", "/galleries/$slug"] as const;

/** 推文作者头像 ↔ 用户主页头像。 */
export const TWEET_AUTHOR_SCOPE = [
	"/tweets",
	"/tweets/$id",
	"/tweets/topics/$tag",
	"/users/$username",
] as const;
