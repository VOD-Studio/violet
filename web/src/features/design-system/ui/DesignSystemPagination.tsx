import { cn } from "@shared/lib/utils";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getSiblingNavItems } from "../model/navigation";

export interface DesignSystemPaginationProps {
	/** 当前章节标识 */
	currentId: string;
	/** 自定义类名 */
	className?: string;
}

/**
 * 营造法式章节上下篇导航：提供连贯的前后翻篇体验。
 *
 * @param props - 分页组件属性
 * @returns 翻页导航卡片
 */
export function DesignSystemPagination({ currentId, className }: DesignSystemPaginationProps) {
	const { prev, next } = getSiblingNavItems(currentId);

	if (!prev && !next) return null;

	return (
		<nav
			aria-label="章节导航"
			className={cn(
				"mt-16 grid grid-cols-1 gap-4 pt-8 border-t border-border/50 sm:grid-cols-2",
				className,
			)}
		>
			{prev ? (
				<Link
					to={prev.to}
					className="group flex flex-col rounded-xl border border-border/60 bg-card/40 p-4 transition-colors hover:border-primary/50 hover:bg-card"
				>
					<div className="flex items-center gap-1.5 text-xs text-muted-foreground group-hover:text-primary">
						<ChevronLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
						<span>上一章 · {prev.num}</span>
					</div>
					<span className="mt-1 font-serif text-base font-semibold tracking-wide text-foreground group-hover:text-primary">
						{prev.title}
					</span>
				</Link>
			) : (
				<div className="hidden sm:block" />
			)}

			{next ? (
				<Link
					to={next.to}
					className="group flex flex-col items-end text-right rounded-xl border border-border/60 bg-card/40 p-4 transition-colors hover:border-primary/50 hover:bg-card sm:col-start-2"
				>
					<div className="flex items-center gap-1.5 text-xs text-muted-foreground group-hover:text-primary">
						<span>下一章 · {next.num}</span>
						<ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
					</div>
					<span className="mt-1 font-serif text-base font-semibold tracking-wide text-foreground group-hover:text-primary">
						{next.title}
					</span>
				</Link>
			) : null}
		</nav>
	);
}
