import type { SeriesDetail } from "@features/series/model/types";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@shared/ui/base/sheet";
import { Link } from "@tanstack/react-router";
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
 * 全书目录（阅读器壳的左层导航）：大屏右侧 sticky 侧栏，高亮当前章。
 * 空书/无章节渲染 null。
 */
export function SeriesToc({ detail, currentSlug }: { detail: SeriesDetail; currentSlug: string }) {
	if (detail.chapter_count === 0) return null;
	return (
		<div className="max-h-[calc(100dvh-8rem)] space-y-1 overflow-y-auto py-1">
			<ChapterList detail={detail} currentSlug={currentSlug} />
		</div>
	);
}

/**
 * 全书目录浮动按钮 + 底部 Sheet（移动端；与章内 TOC FAB 分列两个入口，
 * 见 PRD「移动端两套导航分别进不同抽屉」）。
 */
export function MobileSeriesTocFab({
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
				className="group flex size-11 items-center justify-center rounded-full border border-edge-hairline bg-background/80 shadow-lg backdrop-blur transition-all duration-300 hover:border-primary/50 hover:bg-accent active:scale-90"
			>
				<BookOpen className="size-5 transition-transform duration-300 group-hover:scale-110" />
			</button>
			<SheetContent side="bottom" className="max-h-[70vh] p-0">
				<SheetHeader className="border-b border-edge-hairline">
					<SheetTitle className="font-mono text-xs tracking-wider text-muted-foreground uppercase">
						《{detail.title}》目录
					</SheetTitle>
				</SheetHeader>
				<div className="max-h-[60vh] overflow-y-auto px-4 py-4">
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
