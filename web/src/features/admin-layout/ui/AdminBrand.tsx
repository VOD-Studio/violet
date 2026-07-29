import { cn } from "@shared/lib/utils";
import { Link } from "@tanstack/react-router";

/**
 * AdminBrand - 后台品牌区
 *
 * 桌面侧边栏顶部与移动端抽屉头部共用。徽章 logo + 产品名 + 副标题，
 * 高度 h-14 与 AdminTopBar 对齐，点击回后台概览。
 *
 * collapsed 时仅显示居中徽章；文字始终挂载，用 max-w/opacity 过渡
 * 随侧边栏宽度动画平滑收展（避免条件渲染造成的挤压跳变）。
 */
export function AdminBrand({ collapsed = false }: { collapsed?: boolean }) {
    return (
        <div
            className={cn(
                "flex h-14 shrink-0 items-center border-b",
                collapsed ? "justify-center" : "px-4",
            )}
        >
            <Link
                to="/admin"
                aria-label="Violet 管理后台"
                className={cn("flex items-center", !collapsed && "gap-2.5")}
            >
                <img src="/logo.png" alt="" className="size-8 shrink-0" />
                <span
                    className={cn(
                        "flex flex-col overflow-hidden transition-all duration-200",
                        collapsed ? "max-w-0 opacity-0" : "max-w-24 opacity-100",
                    )}
                >
                    <span className="text-sm leading-tight font-semibold whitespace-nowrap">
                        Violet
                    </span>
                    <span className="text-muted-foreground text-xs leading-tight whitespace-nowrap">
                        管理后台
                    </span>
                </span>
            </Link>
        </div>
    );
}
