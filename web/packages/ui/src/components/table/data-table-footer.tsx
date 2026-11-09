"use client";

import { Pagination } from "../pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../select";

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50];

interface DataTableFooterProps {
	page: number;
	pageSize: number;
	total: number;
	/** 翻页时 pageSize 不变；切换条数时 page 回到 1 */
	onChange: (page: number, pageSize: number) => void;
	pageSizeOptions?: number[];
	hidePageSizeSelect?: boolean;
	container?: HTMLElement | null;
}

/** 分页栏：左侧「共 N 条 · 第 p/P 页」与每页条数，右侧页码。 */
export function DataTableFooter({
	page,
	pageSize,
	total,
	onChange,
	pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
	hidePageSizeSelect = false,
	container,
}: DataTableFooterProps) {
	const totalPages = Math.max(1, Math.ceil(total / pageSize));

	return (
		<div className="v-data-table__footer">
			<span className="v-data-table__total">
				共 <b className="v-table__num">{total}</b> 条 · 第{" "}
				<span className="v-table__num">{page}</span>/
				<span className="v-table__num">{totalPages}</span> 页
			</span>
			{hidePageSizeSelect ? null : (
				<Select
					value={String(pageSize)}
					onValueChange={(value) => onChange(1, Number(value))}
				>
					<SelectTrigger
						controlSize="sm"
						className="v-data-table__page-size"
						aria-label="每页条数"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent container={container} collisionBoundary={container}>
						{pageSizeOptions.map((size) => (
							<SelectItem key={size} value={String(size)}>
								{size} 条/页
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			)}
			<div className="v-data-table__pager">
				<Pagination
					page={page}
					totalPages={totalPages}
					onPageChange={(next) => onChange(next, pageSize)}
				/>
			</div>
		</div>
	);
}
