/**
 * 公告 severity → 视觉配置（单一来源）
 *
 * 供 AnnouncementCard 与公告详情页共用，消除「卡片用 neon / 详情页用 hex」的双轨。
 *
 * 设计取舍：
 * - 配色走基础行为状态 token（destructive/warning/success），info 走品牌低占比，
 *   不绑定具体色阶——palette 与明暗主题切换自动跟随
 * - 图标用 lucide，语义贴「站点运营事件」：info=广播 warning=维护 success=完成 error=故障
 */
import { Check, Megaphone, ServerCrash, Wrench } from "lucide-react";
import type { ComponentType } from "react";

/** 公告严重程度(视觉维度:配色/图标/标签) */
export type AnnouncementSeverity = "info" | "warning" | "success" | "error";

export interface AnnouncementSevCfg {
	/** 药丸徽章 class（背景 + 前景） */
	badge: string;
	/** 纯前景色 class（无底色），供日志电码、状态图标等着色 */
	text: string;
	/** 圆点背景 class */
	dot: string;
	/** lucide 图标组件 */
	Icon: ComponentType<{ className?: string }>;
	/** 中文标签 */
	label: string;
}

export const ANNOUNCEMENT_SEVERITY: Record<AnnouncementSeverity, AnnouncementSevCfg> = {
	info: {
		badge: "bg-primary/10 text-primary",
		text: "text-primary",
		dot: "bg-primary",
		Icon: Megaphone,
		label: "信息",
	},
	warning: {
		badge: "bg-warning/10 text-warning",
		text: "text-warning",
		dot: "bg-warning",
		Icon: Wrench,
		label: "警告",
	},
	success: {
		badge: "bg-success/10 text-success",
		text: "text-success",
		dot: "bg-success",
		Icon: Check,
		label: "成功",
	},
	error: {
		badge: "bg-destructive/10 text-destructive",
		text: "text-destructive",
		dot: "bg-destructive",
		Icon: ServerCrash,
		label: "错误",
	},
};

/** 取 severity 配置，未知值回退到 info */
export function getAnnouncementSev(severity: string | undefined | null): AnnouncementSevCfg {
	if (!severity) return ANNOUNCEMENT_SEVERITY.info;
	return ANNOUNCEMENT_SEVERITY[severity as AnnouncementSeverity] ?? ANNOUNCEMENT_SEVERITY.info;
}
