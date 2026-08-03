import { cn } from "@shared/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@shared/ui/base/tooltip";
import { useRouterState } from "@tanstack/react-router";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { useAdminSidebarStore } from "../admin-sidebar-store";
import { NAV_ITEM_BASE, NavMenuLink } from "./NavMenuLink";
import type { NavMenuItem } from "./nav-menu-config";

/**
 * NavMenuGroupItem - 带子菜单的父项
 *
 * 父项是纯分组容器：点按只切换展开/折叠，不导航（避免无意义的父级页面）。
 * 子项缩进渲染，命中任一子项时父项自动展开并高亮。
 *
 * collapsed（侧边栏收起）时：父项退化为图标 + Tooltip，子项不可见
 * （收起态下展开子菜单会撑破窄栏，与现有 collapsed 语义冲突；保持图标入口即可）。
 */
export function NavMenuGroupItem({
    item,
    onNavigate,
    collapsed = false,
}: {
    item: NavMenuItem;
    onNavigate?: () => void;
    collapsed?: boolean;
}) {
    const pathname = useRouterState({ select: (s) => s.location.pathname });
    const setGroupExpanded = useAdminSidebarStore((s) => s.setGroupExpanded);
    const expandedGroups = useAdminSidebarStore((s) => s.expandedGroups);

    // 命中任一子项（或父项路径本身）时视为激活，自动展开
    const childHit =
        pathname === item.to ||
        pathname.startsWith(`${item.to}/`) ||
        (item.children?.some((c) => pathname === c.to || pathname.startsWith(`${c.to}/`)) ?? false);

    // 手动状态优先于命中路由：未操作时跟随 childHit，手动展开/折叠后固定。
    // 否则命中子路由时 childHit 恒为 true 会覆盖手动折叠，导致无法收起。
    const manualState = expandedGroups[item.to];
    const expanded = manualState !== undefined ? manualState : childHit;

    const Icon: LucideIcon = item.icon;
    const trigger = (
        <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setGroupExpanded(item.to, !expanded)}
            className={cn(NAV_ITEM_BASE, "w-full", collapsed && "justify-center gap-0 px-0")}
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
                        <NavMenuLink
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
