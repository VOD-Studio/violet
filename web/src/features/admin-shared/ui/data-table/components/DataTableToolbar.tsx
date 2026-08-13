import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

interface DataTableToolbarProps {
	/** 左侧筛选槽位，由调用方自定义 */
	toolbar?: ReactNode;
	/** 容器类名 */
	className?: string;
}

/**
 * DataTableToolbar - 顶部工具栏
 *
 * 左侧筛选槽位由调用方填充；列可见性控制在表头行末尾（DataTableHeader）。
 * 选中数量由底部 BulkActionBar 统一展示，此处不再重复。
 */
export function DataTableToolbar({ toolbar, className }: DataTableToolbarProps) {
	if (!toolbar) return null;

	return (
		<div className={cn("flex flex-wrap items-center gap-3 px-1 pb-3", className)}>
			<div className="flex flex-1 flex-wrap items-center gap-2">{toolbar}</div>
		</div>
	);
}
