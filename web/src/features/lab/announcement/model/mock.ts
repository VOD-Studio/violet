import type { Announcement } from "@features/settings/model/types";

/**
 * 公告实验室 mock：7 条静态数据，覆盖四种 severity、card / article
 * 两形态，以及 未生效 / 进行中 / 已收档 三种生命周期样本，不接 API。
 * 日期写死在 2026-07/08，不随观看时间漂移。
 */
export const MOCK_ANNOUNCEMENTS: Announcement[] = [
	{
		id: 12,
		title: "图片服务降级",
		content: "CDN 节点故障，图片加载可能延迟，正在抢修。修复期间文章页图片会先显示占位图。",
		severity: "error",
		display: "card",
		is_active: true,
		excerpt: "CDN 节点故障，图片加载可能延迟，正在抢修。",
		affects: ["media"],
		created_at: "2026-08-16T09:12:00+08:00",
	},
	{
		id: 11,
		title: "数据库例行维护：8 月 22 日 02:00–04:00",
		content: "维护窗口内服务暂停约两小时，请提前保存草稿；窗口结束后自动恢复。",
		severity: "warning",
		display: "article",
		is_active: true,
		start_time: "2026-08-22T02:00:00+08:00",
		end_time: "2026-08-22T04:00:00+08:00",
		excerpt: "维护窗口内服务暂停约两小时，请提前保存草稿。",
		affects: ["site"],
		created_at: "2026-08-15T18:40:00+08:00",
	},
	{
		id: 10,
		title: "v2.0 发布：评论系统重构与 Markdown 实时预览",
		content: "评论系统整体重构，编辑器新增 Markdown 实时预览，并修复了若干体验问题。",
		severity: "success",
		display: "article",
		is_active: true,
		excerpt: "评论系统整体重构，编辑器新增 Markdown 实时预览。",
		affects: ["comments", "posts"],
		created_at: "2026-08-12T20:05:00+08:00",
	},
	{
		id: 9,
		title: "评论鉴权异常已修复",
		content: "GitHub OAuth 回调地址已修正，评论登录恢复正常。",
		severity: "info",
		display: "card",
		is_active: true,
		excerpt: "GitHub OAuth 回调地址已修正，评论登录恢复正常。",
		affects: ["comments", "auth"],
		created_at: "2026-08-11T09:30:00+08:00",
	},
	{
		id: 8,
		title: "RSS 永久地址迁移至 /feed.xml",
		content: "旧地址仍在跳转，订阅器无需改动；新订阅请使用新地址。",
		severity: "info",
		display: "card",
		is_active: false,
		excerpt: "旧地址仍在跳转，订阅器无需改动。",
		affects: ["site"],
		created_at: "2026-08-05T14:00:00+08:00",
	},
	{
		id: 7,
		title: "新域名 violet.blog 生效",
		content: "DNS 已全部切换完成，旧域名 301 跳转到新域名。",
		severity: "success",
		display: "card",
		is_active: false,
		excerpt: "DNS 已全部切换完成，旧域名 301 跳转。",
		affects: ["site"],
		created_at: "2026-07-28T10:00:00+08:00",
	},
	{
		id: 6,
		title: "搜索服务短暂不可用（已恢复）",
		content: "搜索引擎索引重建导致搜索不可用约 40 分钟，现已恢复。",
		severity: "warning",
		display: "card",
		is_active: true,
		end_time: "2026-07-20T18:00:00+08:00",
		excerpt: "索引重建导致搜索不可用约 40 分钟，已恢复。",
		affects: ["search"],
		created_at: "2026-07-20T16:20:00+08:00",
	},
];

/**
 * banner 形态 mock：content 是单行纯文本（横幅条约定），
 * 三条 severity 错开，驱动横幅方向的轮换演示。
 */
export const MOCK_BANNERS: Announcement[] = [
	{
		id: 21,
		title: "RSS 地址迁移",
		content: "RSS 订阅地址已迁移至 /feed.xml，旧地址自动跳转，无需重新订阅",
		severity: "info",
		display: "banner",
		is_active: true,
		affects: ["site"],
		created_at: "2026-08-14T13:00:00+08:00",
	},
	{
		id: 22,
		title: "数据库例行维护预告",
		content: "周六 02:00-04:00 数据库例行维护，期间服务短暂暂停，请提前保存草稿",
		severity: "warning",
		display: "banner",
		is_active: true,
		affects: ["site"],
		created_at: "2026-08-15T18:00:00+08:00",
	},
	{
		id: 23,
		title: "v2.0 发布",
		content: "v2.0 发布：评论系统重构与 Markdown 实时预览已上线",
		severity: "success",
		display: "banner",
		is_active: true,
		affects: ["comments", "posts"],
		created_at: "2026-08-12T20:00:00+08:00",
	},
];
