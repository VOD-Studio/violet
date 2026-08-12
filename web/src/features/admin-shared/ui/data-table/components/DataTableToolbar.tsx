import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

interface DataTableToolbarProps {
	/** 左侧筛选槽位，由调用方自定义 */
	toolbar?: ReactNode;
	/** 当前选中行数，>0 时内联显示提示 */
	selectedCount?: number;
	/** 容器类名 */
	className?: string;
}

/**
 * DataTableToolbar - 顶部工具栏
 *
 * 左侧筛选槽位由调用方填充；选中行时内联显示已选数量。
 * 列可见性控制已移至表头行末尾（DataTableHeader）。
 */
export function DataTableToolbar({ toolbar, selectedCount = 0, className }: DataTableToolbarProps) {
	if (!toolbar && selectedCount === 0) return null;

	return (
		<div className={cn("flex flex-wrap items-center gap-3 px-1 pb-3", className)}>
			{toolbar ? (
				<div className="flex flex-1 flex-wrap items-center gap-2">{toolbar}</div>
			) : (
				<div className="flex-1" />
			)}

			{selectedCount > 0 && (
				<span className="text-muted-foreground text-xs">
					已选 <span className="text-foreground font-medium">{selectedCount}</span> 项
				</span>
			)}
		</div>
	);
}
