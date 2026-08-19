import { cn } from "@shared/lib/utils";
import { Link } from "@tanstack/react-router";

/**
 * AdminBrand - 后台品牌区
 *
 * 桌面侧边栏顶部与移动端抽屉头部共用。徽章 logo + 产品名 + 副标题，
 * 高度 h-14 与 AdminTopBar 对齐，点击回后台概览。
 *
 * collapsed 时仅显示徽章；文字始终挂载，用 max-w/opacity 过渡随侧边栏宽度
 * 动画平滑收展（避免条件渲染造成的挤压跳变）。
 *
 * 布局恒 px-4 + 恒 gap：w-16(64px) 下 16+32+16 恰好容纳 logo，收起态天然
 * 居中，与展开态 logo 位置完全一致——避免 justify-center/gap 条件切换在
 * 过渡期间（文字渐收未完成，Link 总宽大于侧边栏）推动 logo 左右摇晃。
 * overflow-hidden 裁切过渡期间文字超出侧边栏的部分。
 */
export function AdminBrand({ collapsed = false }: { collapsed?: boolean }) {
	return (
		<div className="flex h-14 shrink-0 items-center overflow-hidden border-b px-4">
			<Link to="/admin" aria-label="Violet 管理后台" className="flex items-center gap-2.5">
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
