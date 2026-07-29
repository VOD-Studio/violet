import { Link } from "@tanstack/react-router";

/**
 * AdminBrand - 后台品牌区
 *
 * 桌面侧边栏顶部与移动端抽屉头部共用。徽章 logo + 产品名 + 副标题，
 * 高度 h-14 与 AdminTopBar 对齐，点击回后台概览。
 */
export function AdminBrand() {
    return (
        <Link
            to="/admin"
            aria-label="Violet 管理后台"
            className="flex h-14 shrink-0 items-center gap-2.5 border-b px-4"
        >
            <img src="/logo.png" alt="" className="size-8" />
            <span className="flex flex-col">
                <span className="text-sm leading-tight font-semibold">Violet</span>
                <span className="text-muted-foreground text-xs leading-tight">管理后台</span>
            </span>
        </Link>
    );
}
