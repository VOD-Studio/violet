import ThemeToggle from "@widgets/ThemeToggle/ThemeToggle";
import { AdminMobileNav } from "./AdminMobileNav";

interface AdminTopBarProps {
    /** 当前页标题（由 layout 根据路由匹配解析） */
    title: string;
}

/**
 * AdminTopBar - 顶部栏
 *
 * 左侧：移动端汉堡（AdminMobileNav）+ 页面标题；右侧：主题切换等操作位。
 * 高度对齐侧边栏 header（h-14），语义色 token。
 */
export function AdminTopBar({ title }: AdminTopBarProps) {
    return (
        <header className="bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b px-4 backdrop-blur md:px-6">
            <AdminMobileNav />
            <h1 className="text-base font-semibold">{title}</h1>
            <div className="ml-auto flex items-center gap-1">
                <ThemeToggle />
            </div>
        </header>
    );
}
