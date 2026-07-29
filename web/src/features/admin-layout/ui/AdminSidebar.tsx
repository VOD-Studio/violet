import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AdminBrand } from "./AdminBrand";
import { AdminSidebarBody } from "./AdminSidebarBody";

/**
 * AdminSidebar - 桌面侧边栏
 *
 * hidden md:flex，移动端由 AdminMobileNav 接管。语义色 token，
 * 随全局主题自动切换。品牌区（AdminBrand）+ 分组菜单（AdminSidebarBody）
 * + 底部返回前台。
 */
export function AdminSidebar() {
    return (
        <aside className="hidden w-64 shrink-0 flex-col border-r bg-card md:flex">
            <AdminBrand />
            <div className="flex-1 overflow-y-auto p-3">
                <AdminSidebarBody />
            </div>
            <div className="flex items-center justify-between gap-2 border-t p-3">
                <Link
                    to="/"
                    className="text-muted-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors"
                >
                    <ArrowLeft className="size-4 shrink-0" />
                    返回前台
                </Link>
                <span className="text-muted-foreground/60 px-3 text-xs">v2.0</span>
            </div>
        </aside>
    );
}
