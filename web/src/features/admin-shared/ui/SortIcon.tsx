import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";
import type { DataTableSort } from "./data-table-types";

interface SortIconProps {
	/** 是否为当前激活的排序列 */
	active: boolean;
	/** 激活时的排序方向 */
	order?: DataTableSort["order"];
}

/**
 * SortIcon - 排序方向图标
 *
 * 未激活=双向箭头(半透明)、升序=上箭头、降序=下箭头。
 */
export function SortIcon({ active, order }: SortIconProps) {
	if (!active) return <ChevronsUpDown className="size-3.5 opacity-50" />;
	if (order === "asc") return <ChevronUp className="size-3.5" />;
	return <ChevronDown className="size-3.5" />;
}
