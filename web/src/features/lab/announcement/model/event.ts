import type { Announcement } from "@features/settings/model/types";
import type { AnnouncementSeverity } from "@shared/ui/announcement-severity";

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

/** "MM-DD HH:mm"——直接切 ISO 串，不做时区换算（后端返回 +08:00 时间） */
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
