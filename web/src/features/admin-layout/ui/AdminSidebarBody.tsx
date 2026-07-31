import { useMe } from "@features/auth/api/queries";
import { cn } from "@shared/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@shared/ui/base/tooltip";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { ADMIN_NAV_GROUPS, ADMIN_NAV_ITEMS, type AdminNavItem } from "./AdminNavConfig";
import { useAdminSidebarStore } from "./admin-sidebar-store";

const NAV_ITEM_BASE =
    "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground";

/** 激活态：底色高亮 + 左侧指示条（before 伪元素，不挤压布局） */
const NAV_ITEM_ACTIVE =
    "bg-accent text-accent-foreground before:absolute before:left-0 before:top-1/2 before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-primary before:content-['']";

/** 判断权限：内置超管通配短路，否则看 permissions 任一命中 */
function isVisible(item: AdminNavItem, isSuper: boolean, perms: Set<string>): boolean {
    if (!item.permissions || item.permissions.length === 0) return true;
    if (isSuper) return true;
    return item.permissions.some((code) => perms.has(code));
}

/** 单个菜单项（顶级项与分组项共用渲染）；collapsed 时仅图标 + 右侧 Tooltip */
function AdminNavLink({
    item,
    onNavigate,
    collapsed = false,
}: {
    item: AdminNavItem;
    onNavigate?: () => void;
    collapsed?: boolean;
}) {
    const Icon = item.icon;
    const link = (
        <Link
            to={item.to}
            activeOptions={{ exact: item.exact ?? false }}
            activeProps={{ className: NAV_ITEM_ACTIVE }}
            className={cn(NAV_ITEM_BASE, "group", collapsed && "justify-center gap-0 px-0")}
            onClick={onNavigate}
        >
            <Icon className="size-4 shrink-0" />
            <span
                className={cn(
                    "overflow-hidden transition-all duration-200",
                    collapsed ? "max-w-0 opacity-0" : "max-w-40 opacity-100",
                )}
            >
                {item.label}
            </span>
        </Link>
    );
    if (!collapsed) return link;
    return (
        <Tooltip>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side="right">{item.label}</TooltipContent>
        </Tooltip>
    );
}

/**
 * AdminNavGroupItem - 带子菜单的父项
 *
 * 父项是纯分组容器：点按只切换展开/折叠，不导航（避免无意义的父级页面）。
 * 子项缩进渲染，命中任一子项时父项自动展开并高亮。
 *
 * collapsed（侧边栏收起）时：父项退化为图标 + Tooltip，子项不可见
 * （收起态下展开子菜单会撑破窄栏，与现有 collapsed 语义冲突；保持图标入口即可）。
 */
function AdminNavGroupItem({
    item,
    onNavigate,
    collapsed = false,
}: {
    item: AdminNavItem;
    onNavigate?: () => void;
    collapsed?: boolean;
}) {
    const pathname = useRouterState({ select: (s) => s.location.pathname });
    const toggleGroup = useAdminSidebarStore((s) => s.toggleGroup);
    const expandedGroups = useAdminSidebarStore((s) => s.expandedGroups);

    // 命中任一子项（或父项路径本身）时视为激活，自动展开
    const childHit =
        pathname === item.to ||
        pathname.startsWith(`${item.to}/`) ||
        (item.children?.some((c) => pathname === c.to || pathname.startsWith(`${c.to}/`)) ?? false);

    const expanded = childHit || expandedGroups[item.to] === true;

    const Icon: LucideIcon = item.icon;
    const trigger = (
        <button
            type="button"
            aria-expanded={expanded}
            onClick={() => toggleGroup(item.to)}
            className={cn(
                NAV_ITEM_BASE,
                "w-full",
                collapsed && "justify-center gap-0 px-0",
                childHit && NAV_ITEM_ACTIVE,
            )}
        >
            <Icon className="size-4 shrink-0" />
            <span
                className={cn(
                    "flex-1 overflow-hidden text-left transition-all duration-200",
                    collapsed ? "max-w-0 opacity-0" : "max-w-40 opacity-100",
                )}
            >
                {item.label}
            </span>
            {!collapsed && (
                <ChevronDown
                    className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform",
                        expanded && "rotate-180",
                    )}
                />
            )}
        </button>
    );

    if (collapsed) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>{trigger}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
        );
    }

    return (
        <div className="flex flex-col">
            {trigger}
            {expanded && item.children && (
                <div className="ml-3 mt-0.5 flex flex-col gap-0.5 border-l pl-2">
                    {item.children.map((child) => (
                        <AdminNavLink
                            key={child.to}
                            item={child}
                            onNavigate={onNavigate}
                            collapsed={false}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * AdminSidebarBody - 侧边栏导航主体
 *
 * 桌面 Sidebar 与移动 MobileNav 共用。激活态用 TanStack Router 的
 * activeProps/activeOptions（对齐前台 HeaderNavItem），废弃旧的 [&.active] CSS hack。
 *
 * 菜单按 group 字段分组渲染（概览等顶级项在分组之上），空分组整体隐藏；
 * collapsed 时组标题退化为分隔线。菜单项按 permissions 字段过滤：满足任一权限
 * 才显示；无 permissions 字段仅靠后台路由守卫（admin:access）。内置超管通配短路，
 * 所有项可见。带 children 的项用 AdminNavGroupItem 渲染为可折叠父项，父项可见性 =
 * 任一子项可见。
 */
export function AdminSidebarBody({
    onNavigate,
    collapsed = false,
}: {
    onNavigate?: () => void;
    collapsed?: boolean;
}) {
    const { data: user } = useMe({ enabled: true });
    // 一次性取用户权限集合，避免菜单项逐个调 hook
    const isBuiltinSuperAdmin = user?.is_builtin_super_admin === true;
    const userPerms = new Set(user?.permissions ?? []);

    const visibleItems = ADMIN_NAV_ITEMS.filter((item) => {
        // 父项（有 children）：任一子项可见则父项可见
        if (item.children && item.children.length > 0) {
            return item.children.some((c) => isVisible(c, isBuiltinSuperAdmin, userPerms));
        }
        return isVisible(item, isBuiltinSuperAdmin, userPerms);
    });

    const renderItem = (item: AdminNavItem) =>
        item.children && item.children.length > 0 ? (
            <AdminNavGroupItem
                key={item.to}
                item={item}
                onNavigate={onNavigate}
                collapsed={collapsed}
            />
        ) : (
            <AdminNavLink key={item.to} item={item} onNavigate={onNavigate} collapsed={collapsed} />
        );

    return (
        <nav className="flex flex-col gap-1">
            {visibleItems.filter((item) => !item.group).map(renderItem)}
            {ADMIN_NAV_GROUPS.map((group) => {
                const items = visibleItems.filter((item) => item.group === group.key);
                if (items.length === 0) return null;
                return (
                    <div key={group.key} className="mt-4 flex flex-col gap-1">
                        {collapsed ? (
                            <div className="mx-2 mb-1 border-t" />
                        ) : (
                            <p className="text-muted-foreground/60 px-3 pb-1 text-xs font-medium tracking-wider">
                                {group.label}
                            </p>
                        )}
                        {items.map(renderItem)}
                    </div>
                );
            })}
        </nav>
    );
}
