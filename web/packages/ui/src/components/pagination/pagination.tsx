"use client";

import { cn } from "cn";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ComponentProps } from "react";

/** 页码序列项：页码，或省略号（left/right 仅用作 key）。 */
type PageItem = number | { ellipsis: "left" | "right" };

/** 当前页两侧各保留的相邻页码数。 */
const SIBLING_COUNT = 1;

/** 数字分页：首末页、当前页及其相邻页，其余折成省略号。 */
export interface PaginationProps extends Omit<ComponentProps<"nav">, "children" | "onChange"> {
	/** 当前页，从 1 开始。 */
	page: number;
	/** 总页数；不超过 1 时不渲染。 */
	totalPages: number;
	/** 点击页码或上一页、下一页时回调目标页。 */
	onPageChange: (page: number) => void;
}

/**
 * 页码序列，如 `[1, {left}, 4, 5, 6, {right}, 20]`。
 *
 * @param current - 当前页，从 1 开始
 * @param total - 总页数
 */
function buildPageRange(current: number, total: number): PageItem[] {
	const range: PageItem[] = [1];
	const left = Math.max(2, current - SIBLING_COUNT);
	const right = Math.min(total - 1, current + SIBLING_COUNT);

	if (left > 2) range.push({ ellipsis: "left" });
	for (let p = left; p <= right; p++) range.push(p);
	if (right < total - 1) range.push({ ellipsis: "right" });
	range.push(total);

	return range;
}

/**
 * 数字分页。
 *
 * @remarks 到头的上一页、下一页用 `aria-disabled` 而非 `disabled`：翻到边界时焦点留在原按钮上。
 */
export function Pagination({
	page,
	totalPages,
	onPageChange,
	className,
	"aria-label": ariaLabel = "分页",
	...props
}: PaginationProps) {
	if (totalPages <= 1) return null;

	const atFirst = page <= 1;
	const atLast = page >= totalPages;

	return (
		<nav
			data-slot="pagination"
			aria-label={ariaLabel}
			className={cn("v-pagination", className)}
			{...props}
		>
			<button
				type="button"
				className="v-pagination__step"
				aria-label="上一页"
				aria-disabled={atFirst || undefined}
				onClick={() => {
					if (!atFirst) onPageChange(page - 1);
				}}
			>
				<ChevronLeft aria-hidden="true" focusable="false" />
			</button>

			{buildPageRange(page, totalPages).map((item) => {
				if (typeof item !== "number") {
					return (
						<span
							key={item.ellipsis}
							className="v-pagination__ellipsis"
							data-ellipsis
							aria-hidden="true"
						>
							…
						</span>
					);
				}
				return (
					<button
						key={item}
						type="button"
						className="v-pagination__page"
						aria-label={`第 ${item} 页`}
						aria-current={item === page ? "page" : undefined}
						onClick={() => onPageChange(item)}
					>
						{item}
					</button>
				);
			})}

			<button
				type="button"
				className="v-pagination__step"
				aria-label="下一页"
				aria-disabled={atLast || undefined}
				onClick={() => {
					if (!atLast) onPageChange(page + 1);
				}}
			>
				<ChevronRight aria-hidden="true" focusable="false" />
			</button>
		</nav>
	);
}
