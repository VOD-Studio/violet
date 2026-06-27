import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Smile, Users } from "lucide-react";

/**
 * AdminNavItem - 后台导航项
 *
 * 仅路由型（后台导航全部是路由跳转，不像前台有 action 型）。
 * 对齐 @shared/config/nav.ts 的 NavRouteItem 模型。
 */
export interface AdminNavItem {
	/** 显示文案 */
	label: string;
	/** 路由路径 */
	to: string;
	/** lucide 图标 */
	icon: LucideIcon;
	/** 是否精确匹配激活（首页用 exact） */
	exact?: boolean;
}

/**
 * ADMIN_NAV_ITEMS - 后台导航单一来源
 *
 * AdminSidebar 与 AdminMobileNav 共用此配置。
 */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
	{ label: "概览", to: "/admin", icon: LayoutDashboard, exact: true },
	{ label: "用户管理", to: "/admin/users", icon: Users },
	{ label: "表情管理", to: "/admin/emojis", icon: Smile },
];
