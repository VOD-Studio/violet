import type { LucideIcon } from "lucide-react";
import {
    Activity,
    FileText,
    FolderKanban,
    Images,
    KeyRound,
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
    /**
     * 可见所需权限码（满足任一即显示）。
     * 省略表示仅需 admin:access（由后台路由守卫统一保证）。
     * 内置超管通配短路，永远可见。
     */
    permissions?: string[];
}

/**
 * ADMIN_NAV_ITEMS - 后台导航单一来源
 *
 * AdminSidebar 与 AdminMobileNav 共用此配置。
 * permissions 控制菜单项可见性（满足任一权限即显示）。
 */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
    { label: "概览", to: "/admin", icon: LayoutDashboard, exact: true },
    { label: "文章管理", to: "/admin/posts", icon: FileText, permissions: ["post:view"] },
    { label: "用户管理", to: "/admin/users", icon: Users, permissions: ["user:view"] },
    { label: "角色管理", to: "/admin/roles", icon: UserCog, permissions: ["role:view"] },
    { label: "权限管理", to: "/admin/permissions", icon: Shield, permissions: ["role:view"] },
    { label: "标签管理", to: "/admin/tags", icon: Tag, permissions: ["tag:view"] },
    {
        label: "公告管理",
        to: "/admin/announcements",
        icon: Megaphone,
        permissions: ["announcement:view"],
    },
    {
        label: "评论审核",
        to: "/admin/comments",
        icon: MessageSquare,
        permissions: ["comment:view"],
    },
    { label: "项目管理", to: "/admin/projects", icon: FolderKanban, permissions: ["project:view"] },
    { label: "素材管理", to: "/admin/media", icon: Images, permissions: ["media:view"] },
    {
        label: "表情管理",
        to: "/admin/emojis",
        icon: Smile,
        permissions: ["emoji:view"],
    },
    { label: "站点设置", to: "/admin/settings", icon: Settings, permissions: ["settings:view"] },
    {
        label: "MCP 接入",
        to: "/admin/mcp",
        icon: KeyRound,
        permissions: ["mcp:manage-tokens"],
    },
    { label: "系统监控", to: "/admin/system", icon: Activity, permissions: ["system:view"] },
    { label: "操作日志", to: "/admin/logs", icon: ScrollText, permissions: ["log:view"] },
];
