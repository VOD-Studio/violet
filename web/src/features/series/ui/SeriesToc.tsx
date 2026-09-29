import type { SeriesDetail } from "@features/series/model/types";
import { Link } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@violet/ui";
import { BookOpen } from "lucide-react";
import { useState } from "react";

function ChapterList({
	detail,
	currentSlug,
	onNavigate,
}: {
	detail: SeriesDetail;
	/** 当前章 slug（高亮定位） */
	currentSlug?: string;
	onNavigate?: () => void;
}) {
	const renderItem = (slug: string, chapterNo: number, title: string) => (
		<Link
			key={slug}
			to="/blog/$slug"
			params={{ slug }}
			onClick={onNavigate}
			className={`flex items-baseline gap-2 rounded-md px-2 py-1.5 text-xs leading-snug transition-colors ${
				slug === currentSlug
					? "bg-primary/10 text-primary font-medium"
					: "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
			}`}
		>
			<span className="w-5 shrink-0 font-mono text-[10px] opacity-60">
				{String(chapterNo).padStart(2, "0")}
			</span>
			<span className="min-w-0 flex-1 truncate">{title}</span>
		</Link>
	);
	return (
		<nav aria-label="全书目录" className="space-y-1.5">
			{detail.root_chapters.map((c) => renderItem(c.slug, c.chapter_no, c.title))}
			{detail.sections.map((sec) => (
				<div key={sec.section.id} className="space-y-1">
					{sec.chapters.length > 0 && (
						<p className="text-muted-foreground/70 px-2 pt-1.5 font-mono text-[10px] tracking-wider uppercase">
							{sec.section.title}
						</p>
					)}
					{sec.chapters.map((c) => renderItem(c.slug, c.chapter_no, c.title))}
				</div>
			))}
		</nav>
	);
}

/**
 * 全书目录浮动按钮 + 右侧悬浮面板（全宽度单一入口，不占正文布局列）。
 * 与章内 TOC 分列两个入口；空书/无章节渲染 null。
 */
export function SeriesTocFab({
	detail,
	currentSlug,
}: {
	detail: SeriesDetail;
	currentSlug: string;
}) {
	const [open, setOpen] = useState(false);
	if (detail.chapter_count === 0) return null;

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<button
				type="button"
				onClick={() => setOpen(true)}
				aria-label="打开全书目录"
				className="flex size-11 items-center justify-center rounded-full border border-edge-hairline bg-background/80 text-muted-foreground shadow-lg backdrop-blur transition-colors duration-300 hover:border-primary/50 hover:bg-accent hover:text-foreground"
			>
				<BookOpen className="size-5" />
			</button>
			<SheetContent side="right" className="flex w-80 max-w-[85vw] flex-col p-0">
				<SheetHeader className="border-b border-edge-hairline">
					<SheetTitle className="font-mono text-xs tracking-wider text-muted-foreground uppercase">
						《{detail.title}》目录
					</SheetTitle>
				</SheetHeader>
				<div className="scrollbar-none min-h-0 flex-1 overflow-y-auto px-4 py-4">
					<ChapterList
						detail={detail}
						currentSlug={currentSlug}
						onNavigate={() => setOpen(false)}
					/>
				</div>
			</SheetContent>
		</Sheet>
	);
}
