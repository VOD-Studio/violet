import { usePublishedNote } from "@entities/note/api/queries";
import { useTags } from "@features/tags/api/queries";
import { useArticleImagePreview } from "@shared/hooks/use-article-image-preview";
import { copyText } from "@shared/lib/clipboard";
import { formatDate } from "@shared/lib/date";
import { FloatingBack } from "@shared/ui/floating-back";
import ArticleContent from "@shared/ui/markdown-preview/ArticleContent";
import { Button, Card, Empty, iconProps, PageShell, Skeleton } from "@violet/ui";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { JOURNAL_TIME_ZONE, noteTitle } from "../model/display";
import { journalNoteUrl } from "../model/navigation";
import { NoteBadges, NotePitfallContent, NoteTags } from "./NoteJournalMeta";

/** 展示手记正文、公开元数据以及作者填写的踩坑记录。 */
export function NoteDetailPage({ noteId }: { noteId: string }) {
	const { data: note, isLoading } = usePublishedNote(noteId);
	const { data: tags } = useTags();
	const articleImages = useArticleImagePreview();

	return (
		<PageShell>
			<FloatingBack to="/journal" label="返回手记" />

			{isLoading ? (
				<Card aria-busy="true" className="mx-auto max-w-3xl gap-5 p-6 sm:p-10">
					<Skeleton className="h-5 w-28" />
					<Skeleton className="h-9 w-4/5" />
					<Skeleton className="h-5 w-48" />
					<Skeleton className="h-24 w-full" />
				</Card>
			) : note ? (
				<article className="mx-auto max-w-3xl">
					<Card className="gap-6 p-5 sm:p-10">
						<header className="space-y-4 border-b border-edge-hairline pb-6">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<NoteBadges note={note} />
								<Button
									size="sm"
									variant="ghost"
									leftIcon={<Copy {...iconProps(14)} />}
									onClick={async () => {
										const copied = await copyText(journalNoteUrl(note.id));
										if (copied) {
											toast.success("手记链接已复制");
										} else {
											toast.error("无法复制手记链接");
										}
									}}
								>
									复制链接
								</Button>
							</div>
							<h1 className="wrap-anywhere font-serif text-2xl leading-snug tracking-tight sm:text-3xl">
								{noteTitle(note)}
							</h1>
							<div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
								<time dateTime={note.published_at}>
									{formatDate(
										note.published_at,
										"long-date",
										"—",
										JOURNAL_TIME_ZONE,
									)}
								</time>
								<NoteTags names={note.tags} catalog={tags ?? []} />
							</div>
						</header>
						{note.pitfall && <NotePitfallContent pitfall={note.pitfall} />}
						<section
							{...articleImages.bind}
							className="prose prose-neutral max-w-none font-sans leading-relaxed prose-pre:rounded-lg prose-pre:border prose-pre:border-edge-hairline dark:prose-invert"
						>
							<ArticleContent content={note.content_html} contentType="html" />
						</section>
					</Card>
				</article>
			) : (
				<Empty
					title="手记不可用"
					description="这篇手记可能已删除或不再公开。"
					className="py-20"
				/>
			)}
			{articleImages.preview}
		</PageShell>
	);
}
