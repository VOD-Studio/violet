import type { LucideIcon } from "lucide-react";
import {
    Activity,
    Bot,
    Cpu,
    FileText,
    FolderKanban,
    GitBranch,
    Images,
    KeyRound,
    LayoutDashboard,
    Megaphone,
    MessageSquare,
    Rss,
    ScrollText,
    Settings,
    Shield,
    Smile,
    Tag,
    User,
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
    /** 所属分组；省略为顶级项（概览），渲染在所有分组之上 */
    group?: AdminNavGroup;
    /**
     * 可见所需权限码（满足任一即显示）。
     * 省略表示仅需 admin:access（由后台路由守卫统一保证）。
     * 内置超管通配短路，永远可见。
     */
    permissions?: string[];
    /**
     * 子菜单项。存在时该项渲染为可折叠父项（点按切换展开/收起，不直接导航），
     * 父项本身只作分组容器。父项可见性 = 任一子项可见（权限逻辑同上）。
     * 父项的 `to` 仍需提供，用于当前路由命中任一子项时的激活态判定（前缀匹配）。
     */
    children?: AdminNavItem[];
}

/** 菜单分组标识 */
export type AdminNavGroup = "content" | "member" | "system";

/**
 * ADMIN_NAV_GROUPS - 分组展示顺序与标题
 *
 * 仅定义顺序与文案；组内成员由 ADMIN_NAV_ITEMS 的 group 字段归属。
 */
export const ADMIN_NAV_GROUPS: { key: AdminNavGroup; label: string }[] = [
    { key: "content", label: "内容" },
    { key: "member", label: "用户与权限" },
    { key: "system", label: "系统" },
];

/**
 * ADMIN_NAV_ITEMS - 后台导航单一来源
 *
 * AdminSidebar 与 AdminMobileNav 共用此配置。
 * permissions 控制菜单项可见性（满足任一权限即显示）。
 */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
    { label: "概览", to: "/admin", icon: LayoutDashboard, exact: true },
    {
        label: "文章管理",
        to: "/admin/posts",
        icon: FileText,
        group: "content",
        permissions: ["post:view"],
    },
    {
        label: "标签管理",
        to: "/admin/tags",
        icon: Tag,
        group: "content",
        permissions: ["tag:view"],
    },
    {
        label: "公告管理",
        to: "/admin/announcements",
        icon: Megaphone,
        group: "content",
        permissions: ["announcement:view"],
    },
    {
        label: "评论审核",
        to: "/admin/comments",
        icon: MessageSquare,
        group: "content",
        permissions: ["comment:view"],
    },
    {
        label: "订阅管理",
        to: "/admin/subscriptions",
        icon: Rss,
        group: "content",
        permissions: ["subscription:manage"],
    },
    {
        label: "项目管理",
        to: "/admin/projects",
        icon: FolderKanban,
        group: "content",
        permissions: ["project:view"],
    },
    {
        label: "素材管理",
        to: "/admin/media",
        icon: Images,
        group: "content",
        permissions: ["media:view"],
    },
    {
        label: "表情管理",
        to: "/admin/emojis",
        icon: Smile,
        group: "content",
        permissions: ["emoji:view"],
    },
    {
        label: "用户管理",
        to: "/admin/users",
        icon: Users,
        group: "member",
        permissions: ["user:view"],
    },
    {
        label: "角色管理",
        to: "/admin/roles",
        icon: UserCog,
        group: "member",
        permissions: ["role:view"],
    },
    {
        label: "权限管理",
        to: "/admin/permissions",
        icon: Shield,
        group: "member",
        permissions: ["role:view"],
    },
    {
        label: "站点设置",
        to: "/admin/settings",
        icon: Settings,
        group: "system",
        permissions: ["settings:view"],
        children: [
            {
                label: "基础信息",
                to: "/admin/settings/general",
                icon: Settings,
                permissions: ["settings:view"],
            },
            {
                label: "认证",
                to: "/admin/settings/auth",
                icon: Shield,
                permissions: ["settings:view"],
            },
            {
                label: "GitHub",
                to: "/admin/settings/github",
                icon: GitBranch,
                permissions: ["settings:view"],
            },
            {
                label: "关于",
                to: "/admin/settings/profile",
                icon: User,
                permissions: ["settings:view"],
            },
            {
                label: "LLM 配置",
                to: "/admin/settings/llm",
                icon: Bot,
                permissions: ["settings:view"],
            },
            {
                label: "代码运行器",
                to: "/admin/settings/code-runner",
                icon: Cpu,
                permissions: ["settings:view"],
            },
        ],
    },
    {
        label: "MCP 接入",
        to: "/admin/mcp",
        icon: KeyRound,
        group: "system",
        permissions: ["mcp:manage-tokens"],
    },
    {
        label: "系统监控",
        to: "/admin/system",
        icon: Activity,
        group: "system",
        permissions: ["system:view"],
    },
    {
        label: "操作日志",
        to: "/admin/logs",
        icon: ScrollText,
        group: "system",
        permissions: ["log:view"],
    },
];
