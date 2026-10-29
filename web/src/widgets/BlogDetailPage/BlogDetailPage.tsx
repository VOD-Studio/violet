import type { PostDetail } from "@entities/post/model/types";
import { ArticleRichContent } from "@features/article-rich-content";
import { useMe } from "@features/auth/api/queries";
import { useAnnotationSummary } from "@features/comments/api/queries";
import { ArticleAnnotations } from "@features/comments/ui/ArticleAnnotations";
import { CommentDockButton } from "@features/comments/ui/CommentDockButton";
import { useIncrementView } from "@features/posts/api/mutations";
import { usePost } from "@features/posts/api/queries";
import { ArticleSignature } from "@features/posts/ui/ArticleSignature";
import ArticleToc from "@features/posts/ui/ArticleToc";
import MobileTocFab from "@features/posts/ui/MobileTocFab";
import readingStyles from "@features/posts/ui/PostDetailContent.module.css";
import { PostDetailHeader } from "@features/posts/ui/PostDetailHeader";
import { PostDetailSkeleton } from "@features/posts/ui/PostDetailSkeleton";
import { useChapterContext, useSeriesDetail } from "@features/series/api";
import { ChapterNav, SeriesBelonging } from "@features/series/ui/ChapterNav";
import { SeriesTocFab } from "@features/series/ui/SeriesToc";
import { useSettings } from "@features/settings/api/queries";
import { useArticleImagePreview } from "@shared/hooks/use-article-image-preview";
import { useScrollProgress } from "@shared/hooks/use-scroll-progress";
import { extractToc } from "@shared/hooks/use-toc";
import { extractMarkdownToc } from "@shared/lib/markdown/toc";
import { BackToTop } from "@shared/ui/back-to-top";
import { DeferredContent } from "@shared/ui/deferred-content/DeferredContent";
import { FloatingBack } from "@shared/ui/floating-back";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

/** 文章阅读页的路由输入，不持有路由定义或服务端加载器。 */
export interface BlogDetailPageProps {
	slug: string;
	/** 复用路由加载器取得的文章，使 SSR 正文与首次客户端渲染使用同一数据。 */
	initialPost?: PostDetail;
}

const loadCommentDrawer = () =>
	import("@features/comments/ui/CommentDrawer").then((module) => ({
		default: module.CommentDrawer,
	}));
const loadCommentSection = () =>
	import("@features/comments/ui/CommentSection").then((module) => ({
		default: module.CommentSection,
	}));

function ReadingProgress() {
	const progress = useScrollProgress();
	return (
		<div className="fixed top-0 left-0 right-0 z-50 h-1">
			<div className="h-full bg-progress" style={{ width: `${progress}%` }} />
		</div>
	);
}

/** 组合文章正文、目录、原图预览与按需加载的评论交互。 */
export function BlogDetailPage({ slug, initialPost }: BlogDetailPageProps) {
	const { data: post, isLoading, error } = usePost(slug, initialPost);
	const { mutate: incrementView } = useIncrementView();
	const contentRef = useRef<HTMLElement>(null);
	const articleImages = useArticleImagePreview();
	// 批注数据流：summary 轻量计数用于角标渲染，
	// 点击角标后按 block_id 懒加载完整批注。
	// 自由评论由 CommentSection 内部 useComments(type=free) 独立拉取，互不污染。
	const { data: summary } = useAnnotationSummary(post?.id ?? "");
	const me = useMe();
	const isLoggedIn = !!me.data;
	const { data: chapterCtx } = useChapterContext(slug);
	const { data: seriesDetail } = useSeriesDetail(chapterCtx?.series.slug ?? "");
	const [commentsOpen, setCommentsOpen] = useState(false);
	const [commentsRequested, setCommentsRequested] = useState(false);
	const openComments = () => {
		setCommentsRequested(true);
		setCommentsOpen(true);
	};
	const { data: siteSettings } = useSettings();
	const commentsEnabled = siteSettings?.comments_enabled ?? true;
	const contentType = post?.content_html.trim() ? "html" : "markdown";
	const body = (contentType === "html" ? post?.content_html : post?.content_md) ?? "";
	const toc = useMemo(
		() => (contentType === "html" ? extractToc(body) : extractMarkdownToc(body)),
		[body, contentType],
	);

	// 章节方向键不接管输入域或模态对话框内的交互。
	useEffect(() => {
		if (!chapterCtx) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
			if (e.target instanceof Element && e.target.closest('[aria-modal="true"]')) return;
			const el = e.target as HTMLElement | null;
			if (
				el &&
				(el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)
			) {
				return;
			}
			const target =
				e.key === "ArrowLeft" ? chapterCtx.prev_chapter : chapterCtx.next_chapter;
			if (target) {
				window.location.assign(`/blog/${target.slug}`);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [chapterCtx]);
	useEffect(() => {
		if (!post?.id) return;
		// mutate 保留失败状态但不抛出，统计失败不影响阅读。
		incrementView(post.id);
	}, [post?.id, incrementView]);

	if (isLoading && !post) {
		return <PostDetailSkeleton />;
	}
	if (error || !post) {
		return (
			<div className="container mx-auto flex flex-col items-center px-6 py-32 text-center">
				<h1 className="mb-3 font-mono text-2xl font-bold">文章加载失败</h1>
				<p className="mb-6 text-muted-foreground">该文章可能不存在或已被删除。</p>
				<Link
					to="/blog"
					className="inline-flex items-center gap-2 rounded-lg border border-edge-hairline px-4 py-2 text-sm transition-colors hover:bg-accent"
				>
					<ArrowLeft className="size-4" />
					返回博客
				</Link>
			</div>
		);
	}

	const hasSidebarToc = toc.length > 1;
	// 浏览量乐观显示 +1
	const viewCount = post.view_count + 1;

	return (
		<>
			<ReadingProgress />

			<article
				className={cn(
					"container mx-auto max-w-4xl px-6 py-16",
					hasSidebarToc && "xl:max-w-308",
				)}
			>
				<PostDetailHeader post={post} viewCount={viewCount}>
					<SeriesBelonging context={chapterCtx ?? null} />
				</PostDetailHeader>

				<div
					className={cn(
						"grid min-w-0 grid-cols-1",
						hasSidebarToc && "xl:grid-cols-[minmax(0,1fr)_12.5rem] xl:gap-x-16",
					)}
				>
					<div className="flex min-w-0 flex-col">
						<div className="relative flex min-w-0 flex-col md:mr-32 xl:mx-16">
							<main
								ref={contentRef}
								data-article-content
								onClick={articleImages.bind.onClick}
								onKeyDown={articleImages.bind.onKeyDown}
								className="prose prose-neutral dark:prose-invert min-w-0 max-w-none flex-1 font-article"
							>
								<ArticleRichContent
									key={post.id}
									content={body}
									contentType={contentType}
									className={readingStyles.content}
								/>
								{post.show_signature && post.author ? (
									<ArticleSignature name={post.author.username} />
								) : null}
							</main>

							{commentsEnabled && (
								<ArticleAnnotations
									key={post.id}
									contentRef={contentRef}
									summary={summary ?? []}
									postId={post.id}
									isLoggedIn={isLoggedIn}
								/>
							)}
						</div>

						{chapterCtx ? (
							<div className="relative mt-12 flex">
								<div className="min-w-0 flex-1">
									<ChapterNav context={chapterCtx} />
								</div>
							</div>
						) : null}

						{commentsEnabled && (
							<div className="relative mt-16">
								<DeferredContent
									key={post.id}
									load={loadCommentSection}
									componentProps={{ postId: post.id }}
									label="评论"
									fallback={
										<div className="min-h-32 p-4 text-sm text-muted-foreground">
											评论将在接近时加载。
										</div>
									}
								/>
							</div>
						)}
					</div>

					{hasSidebarToc ? (
						<aside className="hidden min-w-0 xl:block">
							<div className="sticky top-24">
								<ArticleToc
									key={post.id}
									items={toc}
									contentRef={contentRef}
									isRailCollapsedAtRest
									footer={
										commentsEnabled ? (
											<CommentDockButton
												variant="menu"
												onClick={openComments}
											/>
										) : null
									}
								/>
							</div>
						</aside>
					) : null}
				</div>
			</article>

			<FloatingBack to="/blog" label="返回博客" history />
			<div className="fixed right-8 bottom-8 z-40 flex flex-col items-center gap-3 max-lg:bottom-24">
				{hasSidebarToc ? (
					<div className="xl:hidden">
						<MobileTocFab key={post.id} items={toc} contentRef={contentRef} />
					</div>
				) : null}
				{/* 全书目录：悬浮面板单一入口，全宽度可用（不占正文布局列） */}
				{seriesDetail ? <SeriesTocFab detail={seriesDetail} currentSlug={slug} /> : null}
				{commentsEnabled ? (
					<div className={cn(hasSidebarToc && "xl:hidden")}>
						<CommentDockButton variant="fab" onClick={openComments} />
					</div>
				) : null}
				<BackToTop className="relative" />
			</div>

			{commentsEnabled && commentsRequested && (
				<div
					hidden={!commentsOpen}
					className="fixed right-4 top-20 z-50 w-120 max-w-[calc(100vw-2rem)]"
				>
					<DeferredContent
						key={post.id}
						defer={false}
						load={loadCommentDrawer}
						componentProps={{
							open: commentsOpen,
							onClose: () => setCommentsOpen(false),
							postId: post.id,
						}}
						label="评论面板"
						fallback={
							<div className="rounded-2xl border border-border bg-background p-5">
								<p role="status">正在加载评论…</p>
								<button
									type="button"
									onClick={() => setCommentsOpen(false)}
									className="mt-3 rounded-md px-2 py-1 text-primary focus-visible:outline-2 focus-visible:outline-ring"
								>
									关闭
								</button>
							</div>
						}
					/>
				</div>
			)}
			{articleImages.preview}
		</>
	);
}
