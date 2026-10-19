import { GuideTocContent, GuideTocLayout } from "@shared/ui/guide-toc";
import { MarkdownContent } from "@shared/ui/markdown-preview/MarkdownContent";
import { Link, notFound } from "@tanstack/react-router";
import { PageShell } from "@violet/ui";
import { cn } from "cn";
import { EDITOR_GUIDE_CHAPTERS, rewriteChapterLinks } from "../model/chapters";

/** 前后章导航：两端对齐，缺失一侧留占位保持布局稳定。 */
function ChapterNav({ index }: { index: number }) {
	const prev = index > 0 ? EDITOR_GUIDE_CHAPTERS[index - 1] : null;
	const next = index < EDITOR_GUIDE_CHAPTERS.length - 1 ? EDITOR_GUIDE_CHAPTERS[index + 1] : null;
	const linkClass =
		"max-w-1/2 truncate text-sm text-muted-foreground motion-safe:transition-colors hover:text-foreground";
	return (
		<nav className="flex items-center justify-between gap-4 border-t border-border/60 pt-6">
			{prev ? (
				<Link
					to="/editor-guide/$chapter"
					params={{ chapter: prev.id }}
					className={linkClass}
				>
					上一篇 · {prev.title}
				</Link>
			) : (
				<span aria-hidden="true" />
			)}
			<Link
				to="/editor-guide"
				className="shrink-0 text-sm text-muted-foreground motion-safe:transition-colors hover:text-foreground"
			>
				手册目录
			</Link>
			{next ? (
				<Link
					to="/editor-guide/$chapter"
					params={{ chapter: next.id }}
					className={cn(linkClass, "text-right")}
				>
					下一篇 · {next.title}
				</Link>
			) : (
				<span aria-hidden="true" />
			)}
		</nav>
	);
}

/** 手册章节页：页头 + 正文（沿文章 Markdown 管线渲染）+ 前后章导航。 */
export function EditorGuideChapterPage({ chapterId }: { chapterId: string }) {
	const index = EDITOR_GUIDE_CHAPTERS.findIndex((chapter) => chapter.id === chapterId);
	const chapter = EDITOR_GUIDE_CHAPTERS[index];
	if (!chapter) throw notFound();

	return (
		<PageShell className="pt-4 font-sans sm:pt-8">
			<article className="pb-24 font-sans">
				<GuideTocLayout>
					<div className="space-y-10">
						<header className="space-y-3 border-b border-border/60 pb-8">
							<p className="text-sm text-muted-foreground">
								<Link
									to="/editor-guide"
									className="motion-safe:transition-colors hover:text-foreground"
								>
									文章编辑器手册
								</Link>
							</p>
							<h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
								{chapter.title}
							</h1>
							<p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
								{chapter.description}
							</p>
						</header>
						<GuideTocContent contentKey={chapter.id}>
							<MarkdownContent content={rewriteChapterLinks(chapter.source)} />
						</GuideTocContent>
						<ChapterNav index={index} />
					</div>
				</GuideTocLayout>
			</article>
		</PageShell>
	);
}
