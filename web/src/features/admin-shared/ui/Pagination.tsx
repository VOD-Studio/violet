import { Button } from "@shared/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** 分页序列项：页码或省略号（left/right 区分两侧） */
type PageItem = number | { ellipsis: "left" | "right" };

interface PaginationProps {
	page: number;
	totalPages: number;
	onPageChange: (page: number) => void;
}

/** 单侧最多展示的相邻页码数 */
const SIBLING_COUNT = 1;

/**
 * Pagination - 简单数字分页
 *
 * 首尾页 + 当前页前后各 SIBLING_COUNT 页，超距用省略号收拢，
 * 边界自动禁用上一页/下一页。
 */
export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
	if (totalPages <= 1) return null;

	const pages = buildPageRange(page, totalPages);

	return (
		<nav className="flex items-center justify-center gap-1">
			<Button
				variant="outline"
				size="icon-sm"
				onClick={() => onPageChange(page - 1)}
				disabled={page <= 1}
				aria-label="上一页"
			>
				<ChevronLeft className="size-4" />
			</Button>

			{pages.map((item) => {
				if (typeof item !== "number") {
					return (
						<span key={item.ellipsis} className="px-2 text-muted-foreground">
							…
						</span>
					);
				}
				return (
					<Button
						key={item}
						variant={item === page ? "default" : "outline"}
						size="icon-sm"
						onClick={() => onPageChange(item)}
						aria-current={item === page ? "page" : undefined}
					>
						{item}
					</Button>
				);
			})}

			<Button
				variant="outline"
				size="icon-sm"
				onClick={() => onPageChange(page + 1)}
				disabled={page >= totalPages}
				aria-label="下一页"
			>
				<ChevronRight className="size-4" />
			</Button>
		</nav>
	);
}

/** 生成带首尾与省略号的页码序列，如 [1, {left}, 4, 5, 6, {right}, 20] */
function buildPageRange(current: number, total: number): PageItem[] {
	const range: PageItem[] = [];
	const left = Math.max(2, current - SIBLING_COUNT);
	const right = Math.min(total - 1, current + SIBLING_COUNT);

	range.push(1);
	if (left > 2) range.push({ ellipsis: "left" });
	for (let p = left; p <= right; p++) range.push(p);
	if (right < total - 1) range.push({ ellipsis: "right" });
	if (total > 1) range.push(total);

	return range;
}
