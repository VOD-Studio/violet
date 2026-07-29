import { useMe } from "@features/auth/api/queries";
import { cn } from "@shared/lib/utils";
import { Link } from "@tanstack/react-router";
import { ADMIN_NAV_GROUPS, ADMIN_NAV_ITEMS, type AdminNavItem } from "./AdminNavConfig";

const NAV_ITEM_BASE =
    "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground";

/** 激活态：底色高亮 + 左侧指示条（before 伪元素，不挤压布局） */
const NAV_ITEM_ACTIVE =
    "bg-accent text-accent-foreground before:absolute before:left-0 before:top-1/2 before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-primary before:content-['']";

/** 单个菜单项（顶级项与分组项共用渲染） */
function AdminNavLink({ item, onNavigate }: { item: AdminNavItem; onNavigate?: () => void }) {
    const Icon = item.icon;
    return (
        <Link
            to={item.to}
            activeOptions={{ exact: item.exact ?? false }}
            activeProps={{ className: NAV_ITEM_ACTIVE }}
            className={cn(NAV_ITEM_BASE, "group")}
            onClick={onNavigate}
        >
            <Icon className="size-4 shrink-0" />
            <span>{item.label}</span>
        </Link>
    );
}

/**
 * AdminSidebarBody - 侧边栏导航主体
 *
 * 桌面 Sidebar 与移动 MobileNav 共用。激活态用 TanStack Router 的
 * activeProps/activeOptions（对齐前台 HeaderNavItem），废弃旧的 [&.active] CSS hack。
 *
 * 菜单按 group 字段分组渲染（概览等顶级项在分组之上），空分组整体隐藏。
 * 菜单项按 permissions 字段过滤：满足任一权限才显示；无 permissions 字段仅靠后台路由守卫
 * （admin:access）。内置超管通配短路，所有项可见。
 */
export function AdminSidebarBody({ onNavigate }: { onNavigate?: () => void }) {
    const { data: user } = useMe({ enabled: true });
    // 一次性取用户权限集合，避免菜单项逐个调 hook
    const isBuiltinSuperAdmin = user?.is_builtin_super_admin === true;
    const userPerms = new Set(user?.permissions ?? []);

    const visibleItems = ADMIN_NAV_ITEMS.filter((item) => {
        if (!item.permissions || item.permissions.length === 0) return true;
        if (isBuiltinSuperAdmin) return true;
        return item.permissions.some((code) => userPerms.has(code));
    });

    return (
        <nav className="flex flex-col gap-1">
            {visibleItems
                .filter((item) => !item.group)
                .map((item) => (
                    <AdminNavLink key={item.to} item={item} onNavigate={onNavigate} />
                ))}
            {ADMIN_NAV_GROUPS.map((group) => {
                const items = visibleItems.filter((item) => item.group === group.key);
                if (items.length === 0) return null;
                return (
                    <div key={group.key} className="mt-4 flex flex-col gap-1">
                        <p className="text-muted-foreground/60 px-3 pb-1 text-xs font-medium tracking-wider">
                            {group.label}
                        </p>
                        {items.map((item) => (
                            <AdminNavLink key={item.to} item={item} onNavigate={onNavigate} />
                        ))}
                    </div>
                );
            })}
        </nav>
    );
}
