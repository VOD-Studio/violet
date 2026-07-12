import { useMe } from "@features/auth/api/queries";
import { cn } from "@shared/lib/utils";
import { Link } from "@tanstack/react-router";
import { ADMIN_NAV_ITEMS } from "./AdminNavConfig";

const NAV_ITEM_BASE =
    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground";

const NAV_ITEM_ACTIVE = "bg-accent text-accent-foreground";

/**
 * AdminSidebarBody - 侧边栏导航主体
 *
 * 桌面 Sidebar 与移动 MobileNav 共用。激活态用 TanStack Router 的
 * activeProps/activeOptions（对齐前台 HeaderNavItem），废弃旧的 [&.active] CSS hack。
 *
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
            {visibleItems.map((item) => {
                const Icon = item.icon;
                return (
                    <Link
                        key={item.to}
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
            })}
        </nav>
    );
}
