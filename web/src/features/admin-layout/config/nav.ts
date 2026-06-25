/**
 * admin-layout 导航配置
 *
 * 后台侧边栏导航单一来源。
 */
import type { AdminNavItem } from "../model/types";

/**
 * ADMIN_NAV_ITEMS - 后台导航项
 */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
	{ label: "仪表盘", to: "/admin", icon: "LayoutDashboard" },
	{ label: "用户管理", to: "/admin/users", icon: "Users" },
	{ label: "文章管理", to: "/admin/posts", icon: "FileText" },
	{ label: "评论管理", to: "/admin/comments", icon: "MessageSquare" },
	{ label: "角色权限", to: "/admin/roles", icon: "Shield" },
	{ label: "操作日志", to: "/admin/logs", icon: "ScrollText" },
];
