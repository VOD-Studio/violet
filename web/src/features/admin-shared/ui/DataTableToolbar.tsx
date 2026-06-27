import { Columns3, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/shared/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import type { DataTableColumn } from "./data-table-types";

interface DataTableToolbarProps<T> {
	/** 左侧筛选槽位，由调用方自定义 */
	toolbar?: ReactNode;
	/** 全部列定义（含 hideable 过滤后用于可见性菜单） */
	columns: DataTableColumn<T>[];
	/** 当前隐藏的列 key 集合 */
	hiddenKeys: Set<string>;
	/** 切换某列可见性 */
	onToggleColumn: (key: string) => void;
	/** 清空所有隐藏列 */
	onResetColumns: () => void;
	/** 当前选中行数，>0 时内联显示提示 */
	selectedCount?: number;
}

/**
 * DataTableToolbar - 顶部工具栏
 *
 * 左侧筛选槽位由调用方填充；右侧列可见性菜单。
 * 选中行时内联显示已选数量。
 */
export function DataTableToolbar<T>({
	toolbar,
	columns,
	hiddenKeys,
	onToggleColumn,
	onResetColumns,
	selectedCount = 0,
}: DataTableToolbarProps<T>) {
	const hideableColumns = columns.filter((c) => c.hideable !== false);
	const hasHideable = hideableColumns.length > 0;
	const anyHidden = hiddenKeys.size > 0;

	if (!toolbar && !hasHideable && selectedCount === 0) return null;

	return (
		<div className="flex flex-wrap items-center gap-3 px-1 pb-3">
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

			{hasHideable && (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" size="sm">
							<Columns3 className="size-4" />列
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-44">
						<DropdownMenuLabel className="flex items-center justify-between">
							<span>显示列</span>
							{anyHidden && (
								<button
									type="button"
									onClick={onResetColumns}
									className="text-muted-foreground hover:text-foreground"
									title="重置"
								>
									<RotateCcw className="size-3.5" />
								</button>
							)}
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						{hideableColumns.map((col) => (
							<DropdownMenuCheckboxItem
								key={col.key}
								checked={!hiddenKeys.has(col.key)}
								onSelect={(e) => e.preventDefault()}
								onCheckedChange={() => onToggleColumn(col.key)}
							>
								{labelOf(col.header)}
							</DropdownMenuCheckboxItem>
						))}
						{anyHidden && (
							<>
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={onResetColumns}>重置列</DropdownMenuItem>
							</>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			)}
		</div>
	);
}

/** 从列 header 提取菜单显示文案：优先字符串，否则回退 key */
function labelOf(header: ReactNode): string {
	if (typeof header === "string") return header;
	return "列";
}
