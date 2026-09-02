import { usePublishedNote } from "@entities/note/api/queries";
import { useArticleImagePreview } from "@shared/hooks/use-article-image-preview";
import { BackLink } from "@shared/ui/back-link";
import Empty from "@shared/ui/empty";
import { FloatingBack } from "@shared/ui/floating-back";
import ArticleContent from "@shared/ui/markdown-preview/ArticleContent";
import { PageShell } from "@shared/ui/page-shell";
import { Link } from "@tanstack/react-router";
import { noteTitle } from "../model/display";

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
					<header className="mx-auto mb-12 max-w-3xl">
						<h1 className="mb-3 font-mono text-3xl leading-tight font-bold tracking-tight md:text-4xl">
							{noteTitle(note)}
						</h1>
						<div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-sm text-muted-foreground">
							<span>{note.published_at.slice(0, 10)}</span>
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
						className="prose prose-sm prose-neutral mx-auto max-w-3xl dark:prose-invert"
						data-article-content
						onClick={articleImages.bind.onClick}
						onKeyDown={articleImages.bind.onKeyDown}
					>
						<ArticleContent content={note.content_html} />
					</div>
				</article>
			)}
		</PageShell>
	);
}

function NoteDetailSkeleton() {
	return <div className="mx-auto h-8 max-w-3xl animate-pulse bg-muted" />;
}
