import { useMe } from "@features/auth/api/queries";
import { cn } from "@shared/lib/utils";
import { NavMenuGroupItem } from "./NavMenuGroupItem";
import { NavMenuLink } from "./NavMenuLink";
import { NAV_MENU_GROUPS, NAV_MENU_ITEMS, type NavMenuItem } from "./nav-menu-config";

/** 判断权限：内置超管通配短路，否则看 permissions 任一命中 */
function isVisible(item: NavMenuItem, isSuper: boolean, perms: Set<string>): boolean {
	if (!item.permissions || item.permissions.length === 0) return true;
	if (isSuper) return true;
	return item.permissions.some((code) => perms.has(code));
}

const renderItem = (item: NavMenuItem, onNavigate?: () => void, collapsed = false) =>
	item.children && item.children.length > 0 ? (
		<NavMenuGroupItem key={item.to} item={item} onNavigate={onNavigate} collapsed={collapsed} />
	) : (
		<NavMenuLink key={item.to} item={item} onNavigate={onNavigate} collapsed={collapsed} />
	);

/**
 * NavMenu - 后台侧边栏导航菜单主体
 *
 * 桌面 Sidebar 与移动 MobileNav 共用。激活态用 TanStack Router 的
 * activeProps/activeOptions（对齐前台 HeaderNavItem），废弃旧的 [&.active] CSS hack。
 *
 * 菜单按 group 字段分组渲染（概览等顶级项在分组之上），空分组整体隐藏；
 * collapsed 时组标题退化为分隔线。菜单项按 permissions 字段过滤：满足任一权限
 * 才显示；无 permissions 字段仅靠后台路由守卫（admin:access）。内置超管通配短路，
 * 所有项可见。带 children 的项用 NavMenuGroupItem 渲染为可折叠父项，父项可见性 =
 * 任一子项可见。
 */
export function NavMenu({
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

	const visibleItems = NAV_MENU_ITEMS.filter((item) => {
		// 父项（有 children）：任一子项可见则父项可见
		if (item.children && item.children.length > 0) {
			return item.children.some((c) => isVisible(c, isBuiltinSuperAdmin, userPerms));
		}
		return isVisible(item, isBuiltinSuperAdmin, userPerms);
	});

	return (
		<nav className={cn("flex flex-col gap-1")}>
			{visibleItems
				.filter((item) => !item.group)
				.map((item) => renderItem(item, onNavigate, collapsed))}
			{NAV_MENU_GROUPS.map((group) => {
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
						{items.map((item) => renderItem(item, onNavigate, collapsed))}
					</div>
				);
			})}
		</nav>
	);
}
