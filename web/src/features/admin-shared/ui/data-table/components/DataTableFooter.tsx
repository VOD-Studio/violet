import { Pagination } from "@shared/ui/pagination";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/ui/base/select";

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50];

interface DataTableFooterProps {
	page: number;
	pageSize: number;
	total: number;
	onChange: (page: number, pageSize: number) => void;
	/** 可选每页条数选项，默认 `[10, 20, 50]` */
	pageSizeOptions?: number[];
	/** 是否隐藏每页条数选择器，默认 false（显示） */
	hidePageSizeSelect?: boolean;
}

/**
 * DataTableFooter - 底部分页栏
 *
 * 左侧总数信息与每页条数切换（可选），右侧数字分页。
 */
export function DataTableFooter({
	page,
	pageSize,
	total,
	onChange,
	pageSizeOptions,
	hidePageSizeSelect,
}: DataTableFooterProps) {
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const sizeOptions = pageSizeOptions ?? DEFAULT_PAGE_SIZE_OPTIONS;
	const showSizeSelect = !hidePageSizeSelect;

	return (
		<div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-3">
			<div className="text-muted-foreground flex items-center gap-3 text-xs">
				<span>
					共 <span className="text-foreground font-medium">{total}</span> 条 · 第 {page}/
					{totalPages} 页
				</span>
				{showSizeSelect && (
					<Select value={String(pageSize)} onValueChange={(v) => onChange(1, Number(v))}>
						<SelectTrigger size="sm" className="h-7 w-28 text-xs" aria-label="每页条数">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{sizeOptions.map((size) => (
								<SelectItem key={size} value={String(size)}>
									{size} 条/页
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				)}
			</div>
			<Pagination
				page={page}
				totalPages={totalPages}
				onPageChange={(p) => onChange(p, pageSize)}
			/>
		</div>
	);
}
