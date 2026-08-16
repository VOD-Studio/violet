import type { Announcement } from "@features/settings/model/types";
import type { AnnouncementSeverity } from "@shared/ui/announcement-severity";

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

/** 生命周期：未生效（生效窗口未开始）/ 进行中 / 已收档（停用或窗口已过） */
export type EventStatus = "scheduled" | "active" | "ended";

export function statusOf(a: Announcement, now = Date.now()): EventStatus {
	if (a.is_active === false) return "ended";
	if (a.end_time && Date.parse(a.end_time) < now) return "ended";
	if (a.start_time && Date.parse(a.start_time) > now) return "scheduled";
	return "active";
}

/** 按创建时间倒序（日志流、面板分组的组内序都用它） */
export function byNewest(list: Announcement[]): Announcement[] {
	return [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** "MM-DD HH:mm"——直接切 ISO 串，不做时区换算（mock 自带 +08:00） */
export function fmtStamp(iso: string): string {
	return iso.slice(5, 16).replace("T", " ");
}

/** "MM-DD" */
export function fmtDate(iso: string): string {
	return iso.slice(5, 10);
}

/** 同日生效窗口 "MM-DD HH:mm–HH:mm" */
export function fmtWindow(a: Announcement): string {
	if (!a.start_time || !a.end_time) return "";
	return `${fmtStamp(a.start_time)}–${a.end_time.slice(11, 16)}`;
}

/** 事件日志的三字母电码 */
export const SEV_CODE: Record<AnnouncementSeverity, string> = {
	info: "INFO",
	warning: "WARN",
	success: "OK",
	error: "ERROR",
};
