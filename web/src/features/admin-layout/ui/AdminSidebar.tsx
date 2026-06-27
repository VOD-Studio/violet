import { Separator } from "@shared/ui/separator";
import { AdminSidebarBody } from "./AdminSidebarBody";

/**
 * AdminSidebar - 桌面侧边栏
 *
 * hidden md:flex，移动端由 AdminMobileNav 接管。语义色 token，
 * 随全局主题自动切换。
 */
export function AdminSidebar() {
	return (
		<aside className="hidden w-64 shrink-0 flex-col border-r bg-card md:flex">
			<div className="flex h-14 items-center gap-2 border-b px-5">
				<span className="bg-primary size-6 rounded-md" />
				<span className="text-base font-semibold">Mimo Admin</span>
			</div>
			<div className="flex-1 overflow-y-auto p-3">
				<AdminSidebarBody />
			</div>
			<Separator />
			<div className="p-3">
				<p className="text-muted-foreground px-3 text-xs">v2.0</p>
			</div>
		</aside>
	);
}
