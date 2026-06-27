import { Pagination } from "./Pagination";

interface DataTableFooterProps {
	page: number;
	pageSize: number;
	total: number;
	onPageChange: (page: number) => void;
}

/**
 * DataTableFooter - 底部分页栏
 *
 * 左侧总数信息（共 N 条 · 第 x/y 页），右侧复用 Pagination 数字分页。
 */
export function DataTableFooter({ page, pageSize, total, onPageChange }: DataTableFooterProps) {
	const totalPages = Math.max(1, Math.ceil(total / pageSize));

	return (
		<div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-3">
			<p className="text-muted-foreground text-xs">
				共 <span className="text-foreground font-medium">{total}</span> 条 · 第 {page}/{totalPages}{" "}
				页
			</p>
			<Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
		</div>
	);
}
