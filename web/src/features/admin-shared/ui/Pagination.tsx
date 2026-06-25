import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PaginationProps {
	page: number;
	totalPages: number;
	onChange: (page: number) => void;
	className?: string;
}

/**
 * Pagination - 简单分页器
 *
 * 显示上一页/下一页与当前页码，适用于后台表格分页。
 */
export function Pagination({ page, totalPages, onChange, className }: PaginationProps) {
	return (
		<div className={cn("flex items-center justify-end gap-2", className)}>
			<Button variant="outline" size="sm" onClick={() => onChange(page - 1)} disabled={page <= 1}>
				<ChevronLeft className="size-4" />
			</Button>
			<span className="font-mono text-sm text-muted-foreground">
				{page} / {Math.max(1, totalPages)}
			</span>
			<Button
				variant="outline"
				size="sm"
				onClick={() => onChange(page + 1)}
				disabled={page >= totalPages}
			>
				<ChevronRight className="size-4" />
			</Button>
		</div>
	);
}
