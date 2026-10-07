import type { PostDetail } from "@entities/post/model/types";
import { ArticleRichContent } from "@features/article-rich-content";
import { useMe } from "@features/auth/api/queries";
import { commentKeys } from "@features/comments/api/keys";
import { fetchAnnotationSummary, useAnnotationSummary } from "@features/comments/api/queries";
import { postKeys } from "@features/posts/api/keys";
import { fetchPostBySlug, usePost } from "@features/posts/api/queries";
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
import { apiPost } from "@shared/api/request";
import { SITE_URL } from "@shared/config/env";
import { useArticleImagePreview } from "@shared/hooks/use-article-image-preview";
import { useScrollProgress } from "@shared/hooks/use-scroll-progress";
import { extractToc } from "@shared/hooks/use-toc";
import { extractMarkdownToc } from "@shared/lib/markdown/toc";
import { BackToTop } from "@shared/ui/back-to-top";
import { FloatingBack } from "@shared/ui/floating-back";
import { createFileRoute, Link } from "@tanstack/react-router";
import { cn } from "cn";
import { ArrowLeft } from "lucide-react";
import { lazy, Suspense, useEffect, useRef } from "react";

// 评论交互懒加载，不阻塞首屏正文。
const AnnotationLayer = lazy(() =>
	import("@features/comments/ui/AnnotationLayer").then((m) => ({
		default: m.AnnotationLayer,
	})),
);
const FloatingToolbar = lazy(() =>
	import("@features/comments/ui/FloatingToolbar").then((m) => ({
		default: m.FloatingToolbar,
	})),
);
const CommentSection = lazy(() =>
	import("@features/comments/ui/CommentSection").then((m) => ({
		default: m.CommentSection,
	})),
);

function BlogDetailPage() {
	const { slug } = Route.useParams();
	const { data: post, isLoading, error } = usePost(slug);
	const contentRef = useRef<HTMLElement>(null);
	const progress = useScrollProgress();
	const articleImages = useArticleImagePreview();
	// 批注数据流：summary 轻量计数用于角标渲染，
	// 点击角标后按 block_id 懒加载完整批注。
	// 自由评论由 CommentSection 内部 useComments(type=free) 独立拉取，互不污染。
	const { data: summary } = useAnnotationSummary(post?.id ?? "");
	const me = useMe();
	const isLoggedIn = !!me.data;
	const { data: chapterCtx } = useChapterContext(slug);
	const { data: seriesDetail } = useSeriesDetail(chapterCtx?.series.slug ?? "");
	const { data: siteSettings } = useSettings();
	const commentsEnabled = siteSettings?.comments_enabled ?? true;

	// ←/→ 键盘章节导航：目标章节存在且焦点不在输入域时跳转
	useEffect(() => {
		if (!chapterCtx) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
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
		apiPost(`/posts/${post.id}/view`).catch(() => {
			/* 浏览量统计失败不阻塞阅读 */
		});
	}, [post?.id]);

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

	// 正文渲染：content_html 为权威源（保颜色/对齐等 inline 样式），空则降级 content_md。
	const contentType = post.content_html.trim() ? "html" : "markdown";
	const body = contentType === "html" ? post.content_html : post.content_md;
	const toc = contentType === "html" ? extractToc(body) : extractMarkdownToc(body);
	const hasSidebarToc = toc.length > 1;
	// 浏览量乐观显示 +1
	const viewCount = post.view_count + 1;

	return (
		<>
			{/* 顶部阅读进度条（无 transition 避免底部抖动） */}
			<div className="fixed top-0 left-0 right-0 z-50 h-1">
				<div
					className="h-full bg-linear-to-r from-primary-base to-primary-base-hover"
					style={{ width: `${progress}%` }}
				/>
			</div>

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
					<div className="relative flex min-w-0 flex-col">
						<main
							ref={contentRef}
							data-article-content
							onClick={articleImages.bind.onClick}
							onKeyDown={articleImages.bind.onKeyDown}
							className="prose prose-neutral dark:prose-invert min-w-0 max-w-none flex-1 font-reading"
						>
							<ArticleRichContent
								content={body}
								contentType={contentType}
								className={readingStyles.content}
							/>
							{post.show_signature && post.author ? (
								<ArticleSignature name={post.author.username} />
							) : null}
						</main>

						{chapterCtx ? (
							<div className="relative mt-12 flex">
								<div className="min-w-0 flex-1">
									<ChapterNav context={chapterCtx} />
								</div>
							</div>
						) : null}

						{/* 批注角标按 summary 渲染，完整批注在点击后加载。 */}
						{commentsEnabled && (
							<Suspense fallback={null}>
								<AnnotationLayer
									contentRef={contentRef}
									summary={summary ?? []}
									postId={post.id}
									isLoggedIn={isLoggedIn}
								/>
							</Suspense>
						)}

						{commentsEnabled && (
							<Suspense fallback={null}>
								<FloatingToolbar
									contentRef={contentRef}
									isLoggedIn={isLoggedIn}
									postId={post.id}
								/>
							</Suspense>
						)}

						{commentsEnabled && (
							<div className="relative mt-16 flex">
								<Suspense
									fallback={
										<div className="min-h-32 w-full animate-pulse rounded-lg bg-muted/40" />
									}
								>
									<CommentSection postId={post.id} />
								</Suspense>
							</div>
						)}
					</div>

					{hasSidebarToc ? (
						<aside className="hidden min-w-0 xl:block">
							<div className="sticky top-24">
								<ArticleToc
									items={toc}
									contentRef={contentRef}
									isRailCollapsedAtRest
								/>
							</div>
						</aside>
					) : null}
				</div>
			</article>

			{/*
			 * 右下角浮动操作区（flex-col 竖列）：目录按钮（仅小屏，大屏用侧边目录）+ 返回顶部。
			 * 同一 fixed 容器，避免与全局 MusicPlayer 等右下角元素重叠。
			 */}
			<FloatingBack to="/blog" label="返回博客" history />
			{hasSidebarToc || seriesDetail ? (
				<div className="fixed right-8 bottom-8 z-40 flex flex-col items-center gap-3">
					{hasSidebarToc ? (
						<div className="xl:hidden">
							<MobileTocFab items={toc} contentRef={contentRef} />
						</div>
					) : null}
					{/* 全书目录：悬浮面板单一入口，全宽度可用（不占正文布局列） */}
					{seriesDetail ? (
						<SeriesTocFab detail={seriesDetail} currentSlug={slug} />
					) : null}
					<BackToTop className="relative" />
				</div>
			) : (
				<BackToTop />
			)}
		</>
	);
}

export const Route = createFileRoute("/blog/$slug")({
	pendingComponent: PostDetailSkeleton,
	pendingMs: 0,
	pendingMinMs: 200,
	loader: async ({ context, params }) => {
		const post = await context.queryClient.ensureQueryData({
			queryKey: postKeys.detail(params.slug),
			queryFn: () => fetchPostBySlug(params.slug),
		});
		if (post?.id) {
			void context.queryClient.prefetchQuery({
				queryKey: commentKeys.annotationSummary(post.id),
				queryFn: () => fetchAnnotationSummary(post.id),
			});
		}
		return post;
	},
	// 动态 SEO：映射文章的 seo_title / seo_description / 封面图 / canonical
	// rel=canonical：canonical_url 非空（转载）→ 指源（避免被 Google 当抄袭降权）；
	// 空（原创）→ 自指本站绝对 URL（Google 建议 rel=canonical 用绝对地址）。
	// og:url 是本页面对象标识，始终指本站绝对 URL——转载也不把社交图谱归属让渡给源站。
	head: ({ loaderData }) => {
		const post = loaderData as PostDetail | undefined;
		if (!post) return { meta: [] };
		const pageUrl = `${SITE_URL.replace(/\/+$/, "")}/blog/${post.slug}`;
		const canonicalHref = post.canonical_url || pageUrl;
		return {
			meta: [
				{ title: post.seo_title || post.title },
				{ name: "description", content: post.seo_description || post.excerpt },
				{ property: "og:title", content: post.seo_title || post.title },
				{ property: "og:description", content: post.seo_description || post.excerpt },
				...(post.cover_image ? [{ property: "og:image", content: post.cover_image }] : []),
				{ property: "og:type", content: "article" },
				{ property: "og:url", content: pageUrl },
			],
			links: [{ rel: "canonical", href: canonicalHref }],
		};
	},
	component: BlogDetailPage,
});
