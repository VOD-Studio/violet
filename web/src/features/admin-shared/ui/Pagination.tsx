import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getPageRange } from "../lib/get-page-range";

export interface PaginationProps {
	/** 当前页 1-based */
	page: number;
	/** 总条数，服务端返回，提供后显示共 N 条与每页条数选择 */
	total?: number;
	/** 每页条数，配合 total 计算总页与当前区间 */
	pageSize?: number;
	/** 总页数，旧接口入参，与 total/pageSize 二选一 */
	totalPages?: number;
	/** 页码变更回调，新接口 */
	onPageChange?: (page: number) => void;
	/** 页码变更回调，旧接口别名，向后兼容 */
	onChange?: (page: number) => void;
	/** 每页条数变更回调，提供后显示每页条数选择器 */
	onPageSizeChange?: (size: number) => void;
	/** 每页条数候选，默认 [10,20,50,100] */
	pageSizeOptions?: number[];
	className?: string;
}

/**
 * Pagination - 分页器
 *
 * 支持页码导航、每页条数选择、信息展示，兼容新旧接口。
 */
export function Pagination({
	page,
	total,
	pageSize,
	totalPages,
	onPageChange,
	onChange,
	onPageSizeChange,
	pageSizeOptions = [10, 20, 50, 100],
	className,
}: PaginationProps) {
	const size = pageSize ?? 10;
	const pages = Math.max(1, totalPages ?? Math.ceil((total ?? 0) / size));
	const emit = onPageChange ?? onChange;

	const go = (p: number) => {
		const target = Math.max(1, Math.min(p, pages));
		if (target !== page) {
			emit?.(target);
		}
	};

	const range = getPageRange(page, pages);

	const start = (page - 1) * size + 1;
	const end = Math.min(page * size, total ?? 0);

	return (
		<div className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
			<div className="flex items-center gap-3">
				{total != null && (
					<span className="font-mono text-xs text-muted-foreground">
						{total === 0 ? "共 0 条" : `共 ${total} 条 · 第 ${start}-${end} 条`}
					</span>
				)}
				{onPageSizeChange && (
					<Select value={String(size)} onValueChange={(v: string) => onPageSizeChange(Number(v))}>
						<SelectTrigger className="h-8 w-[92px]">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{pageSizeOptions.map((n) => (
								<SelectItem key={n} value={String(n)}>
									{n} 条/页
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				)}
			</div>

			<div className="flex items-center gap-1">
				<Button
					variant="outline"
					size="icon-xs"
					aria-label="上一页"
					onClick={() => go(page - 1)}
					disabled={page <= 1}
				>
					<ChevronLeft className="size-3" />
				</Button>

				<div className="hidden sm:flex items-center gap-1">
					{range.map((item, idx) => {
						if (item === "ellipsis") {
							return (
								<span key={`gap-${range[idx - 1]}`} className="px-1 text-muted-foreground">
									…
								</span>
							);
						}
						const isCurrent = item === page;
						return (
							<Button
								key={item}
								variant={isCurrent ? "default" : "ghost"}
								size="icon-xs"
								aria-current={isCurrent ? "page" : undefined}
								onClick={() => go(item)}
							>
								{item}
							</Button>
						);
					})}
				</div>

				<span className="font-mono text-sm text-muted-foreground sm:hidden">
					{page} / {pages}
				</span>

				<Button
					variant="outline"
					size="icon-xs"
					aria-label="下一页"
					onClick={() => go(page + 1)}
					disabled={page >= pages}
				>
					<ChevronRight className="size-3" />
				</Button>
			</div>
		</div>
	);
}
