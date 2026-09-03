import { usePublishedNote } from "@entities/note/api/queries";
import { useArticleImagePreview } from "@shared/hooks/use-article-image-preview";
import { BackLink } from "@shared/ui/back-link";
import Empty from "@shared/ui/empty";
import { FloatingBack } from "@shared/ui/floating-back";
import ArticleContent from "@shared/ui/markdown-preview/ArticleContent";
import { PageShell } from "@shared/ui/page-shell";
import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";
import { Link } from "@tanstack/react-router";
import { noteDate, notePlainLength, noteTitle } from "../model/display";

interface NoteDetailPageProps {
	noteId: string;
}

export function NoteDetailPage({ noteId }: NoteDetailPageProps) {
	const { data: note, isLoading, isError } = usePublishedNote(noteId);
	const articleImages = useArticleImagePreview();

	return (
		<PageShell>
			<BackLink to="/notes" label="笔记" className="mb-8" />
			<FloatingBack to="/notes" label="返回笔记" />

			{isLoading ? (
				<NoteDetailSkeleton />
			) : isError || !note ? (
				<Empty
					title="笔记不存在"
					description="可能已被删除，或从未发布"
					className="py-20"
					size="lg"
				/>
			) : (
				<article>
					<header className="mx-auto mb-10 max-w-3xl">
						<p className="font-mono text-muted-foreground mb-4 text-xs tracking-[0.3em] uppercase">
							Field Note
						</p>
						<h1 className="text-4xl leading-[1.2] font-bold tracking-tight md:text-5xl">
							{noteTitle(note)}
						</h1>
						<div className="border-edge-hairline text-muted-foreground mt-7 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-y py-3 font-mono text-xs">
							<span className="flex gap-x-5 tabular-nums">
								<span>{noteDate(note.published_at)}</span>
								<span>{notePlainLength(note.content_html)} 字</span>
							</span>
							{note.tags.length > 0 ? (
								<span className="flex flex-wrap gap-x-3">
									{note.tags.map((t) => (
										<Link
											key={t}
											to="/notes"
											search={{ tag: t }}
											className="transition-colors hover:text-foreground"
										>
											#{t}
										</Link>
									))}
								</span>
							) : null}
						</div>
					</header>

					<div
						className="prose prose-neutral dark:prose-invert mx-auto max-w-3xl"
						data-article-content
						onClick={articleImages.bind.onClick}
						onKeyDown={articleImages.bind.onKeyDown}
					>
						<ArticleContent content={note.content_html} />
					</div>

					<footer className="mx-auto mt-16 max-w-3xl">
						<Link
							to="/notes"
							className="group border-edge-hairline flex items-baseline justify-between border-t pt-5"
						>
							<span className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground/50 uppercase transition-colors group-hover:text-muted-foreground">
								&larr; Index
							</span>
							<span className="text-foreground group-hover:underline-offset-4 group-hover:underline text-lg font-medium">
								返回笔记索引
							</span>
						</Link>
					</footer>
				</article>
			)}
		</PageShell>
	);
}

function NoteDetailSkeleton() {
	return (
		<div aria-hidden className="mx-auto max-w-3xl space-y-6">
			<ShimmerSkeleton className="h-3 w-24" />
			<ShimmerSkeleton className="h-10 w-4/5" />
			<ShimmerSkeleton className="h-3.5 w-48" />
			<div className="border-edge-hairline border-t pt-6" />
			<div className="space-y-3">
				<ShimmerSkeleton className="h-4 w-full" />
				<ShimmerSkeleton className="h-4 w-11/12" />
				<ShimmerSkeleton className="h-4 w-4/5" />
				<ShimmerSkeleton className="h-4 w-full" />
				<ShimmerSkeleton className="h-4 w-2/3" />
			</div>
		</div>
	);
}
