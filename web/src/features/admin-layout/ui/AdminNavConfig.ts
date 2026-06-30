import type { LucideIcon } from "lucide-react";
import {
    FolderKanban,
    Images,
    LayoutDashboard,
    Megaphone,
    MessageSquare,
    ScrollText,
    Settings,
    Shield,
    Smile,
    Tag,
    UserCog,
    Users,
} from "lucide-react";

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
    { label: "角色管理", to: "/admin/roles", icon: UserCog },
    { label: "权限管理", to: "/admin/permissions", icon: Shield },
    { label: "标签管理", to: "/admin/tags", icon: Tag },
    { label: "公告管理", to: "/admin/announcements", icon: Megaphone },
    { label: "评论审核", to: "/admin/comments", icon: MessageSquare },
    { label: "项目管理", to: "/admin/projects", icon: FolderKanban },
    { label: "素材管理", to: "/admin/media", icon: Images },
    { label: "表情管理", to: "/admin/emojis", icon: Smile },
    { label: "站点设置", to: "/admin/settings", icon: Settings },
    { label: "操作日志", to: "/admin/logs", icon: ScrollText },
];
