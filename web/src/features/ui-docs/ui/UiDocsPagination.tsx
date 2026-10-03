import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getSiblingNavItems } from "../model/navigation";

/** 根据目录顺序定位相邻文档。 */
export interface UiDocsPaginationProps {
	currentId: string;
	className?: string;
}

export function UiDocsPagination({ currentId, className }: UiDocsPaginationProps) {
	const { prev, next } = getSiblingNavItems(currentId);
	if (!prev && !next) return null;

	return (
		<nav
			aria-label="文档翻页"
			className={cn("mt-12 grid gap-4 border-t border-border pt-6 sm:grid-cols-2", className)}
		>
			{prev ? (
				<Link
					to={prev.to}
					className="rounded-lg border border-border p-4 motion-safe:transition-colors hover:bg-accent/50"
				>
					<span className="flex items-center gap-1.5 text-xs text-muted-foreground">
						<ChevronLeft className="size-3.5" aria-hidden="true" />
						上一页
					</span>
					<span className="mt-1 block text-sm font-medium text-foreground">
						{prev.title}
					</span>
				</Link>
			) : (
				<div className="hidden sm:block" />
			)}
			{next && (
				<Link
					to={next.to}
					className="rounded-lg border border-border p-4 text-right motion-safe:transition-colors hover:bg-accent/50 sm:col-start-2"
				>
					<span className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
						下一页
						<ChevronRight className="size-3.5" aria-hidden="true" />
					</span>
					<span className="mt-1 block text-sm font-medium text-foreground">
						{next.title}
					</span>
				</Link>
			)}
		</nav>
	);
}
