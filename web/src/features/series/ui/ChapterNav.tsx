import type { ChapterContext } from "@features/series/model/types";
import { Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";

/**
 * 文章头的书籍归属标注：「属于《书名》· 第 N 章」。
 * context 为 null（未挂书/书未发布）时渲染 null。
 */
export function SeriesBelonging({ context }: { context: ChapterContext | null }) {
	if (!context) return null;
	return (
		<Link
			to="/series/$slug"
			params={{ slug: context.series.slug }}
			className="hover:text-foreground mb-4 inline-flex items-center gap-1.5 font-mono text-sm text-muted-foreground transition-colors"
		>
			<BookOpen className="size-3.5" />
			属于《{context.series.title}》
			{context.chapter_no > 0 ? ` · 第 ${context.chapter_no} 章` : ""}
		</Link>
	);
}

/**
 * 正文后的上一章/下一章导航：与正文同宽（大屏含 TOC 偏移由调用方对齐）。
 * 均为 null 时渲染 null。
 */
export function ChapterNav({ context }: { context: ChapterContext | null }) {
	if (!context || (!context.prev_chapter && !context.next_chapter)) return null;
	return (
		<nav className="grid grid-cols-1 gap-4 sm:grid-cols-2" aria-label="章节导航">
			{context.prev_chapter ? (
				<Link
					to="/blog/$slug"
					params={{ slug: context.prev_chapter.slug }}
					className="hover:bg-muted/60 group rounded-xl border border-edge-hairline p-4 transition-colors"
				>
					<span className="text-muted-foreground font-mono text-xs">← 上一章</span>
					<span className="group-hover:text-foreground mt-1.5 block truncate text-sm font-medium">
						{context.prev_chapter.title}
					</span>
				</Link>
			) : (
				<div className="hidden sm:block" aria-hidden="true" />
			)}
			{context.next_chapter ? (
				<Link
					to="/blog/$slug"
					params={{ slug: context.next_chapter.slug }}
					className="hover:bg-muted/60 group rounded-xl border border-edge-hairline p-4 text-end transition-colors"
				>
					<span className="text-muted-foreground font-mono text-xs">下一章 →</span>
					<span className="group-hover:text-foreground mt-1.5 block truncate text-sm font-medium">
						{context.next_chapter.title}
					</span>
				</Link>
			) : (
				<div className="hidden sm:block" aria-hidden="true" />
			)}
		</nav>
	);
}
