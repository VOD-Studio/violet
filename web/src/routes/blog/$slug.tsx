import type { PostDetail } from "@entities/post/model/types";
import { useMe } from "@features/auth/api/queries";
import { commentKeys } from "@features/comments/api/keys";
import { fetchAnnotationSummary, useAnnotationSummary } from "@features/comments/api/queries";
import { BackLink } from "@features/lab/nav/ui/BackLink";
import { postKeys } from "@features/posts/api/keys";
import { fetchPostBySlug, usePost } from "@features/posts/api/queries";
import ArticleToc from "@features/posts/ui/ArticleToc";
import MobileTocFab from "@features/posts/ui/MobileTocFab";
import { PostDetailSkeleton } from "@features/posts/ui/PostDetailSkeleton";
import { useChapterContext, useSeriesDetail } from "@features/series/api";
import { ChapterNav, SeriesBelonging } from "@features/series/ui/ChapterNav";
import { MobileSeriesTocFab, SeriesToc } from "@features/series/ui/SeriesToc";
import { useSettings } from "@features/settings/api/queries";
import { apiPost } from "@shared/api/request";
import { SITE_URL } from "@shared/config/env";
import { useArticleImagePreview } from "@shared/hooks/use-article-image-preview";
import { useScrollProgress } from "@shared/hooks/use-scroll-progress";
import { extractToc } from "@shared/hooks/use-toc";
import { extractMarkdownToc } from "@shared/lib/markdown/toc";
import { AvatarGroup } from "@shared/ui/avatar-group";
import { BackToTop } from "@shared/ui/back-to-top";
import { FloatingBack } from "@shared/ui/floating-back";
import { CroppedImage } from "@shared/ui/image-cropper/CroppedImage";
import ArticleContent from "@shared/ui/markdown-preview/ArticleContent";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Calendar, ExternalLink, Eye } from "lucide-react";
import { lazy, Suspense, useEffect, useRef } from "react";

/**
 * 评论相关组件懒加载：批注层 / 浮动工具条 / 评论区都在首屏可视区下方，
 * 且依赖较重（评论 API、表单、树结构等），拆出独立 chunk 不阻塞首屏正文渲染。
 */
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

/**
 * /blog/$slug - 文章详情页
 *
 * loader SSR 预取文章（按 slug），组件读缓存。
 *
 * 正文统一用 react-markdown 渲染 content_md（复用 markdownComponents 手写样式映射），
 * 不再用 content_html 直出（避免样式不受控）。
 * TOC 从 content_md 提取（github-slugger id 与 rehype-slug 一致，锚点可跳转）。
 * 进入页面时调用 POST /posts/{id}/view 增加浏览量。
 * 路由 head 映射 SEO 字段（title/description/og:image）。
 */
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
	// 书籍上下文：归属标注 + 上下章导航（未挂书为 null，组件自渲染 null）
	const { data: chapterCtx } = useChapterContext(slug);
	// 全书目录（阅读器壳左层导航）：按归属书 slug 拉详情
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
	// ArticleContent 自动识别 HTML / Markdown 并正确渲染。
	const body = post.content_html.trim() ? post.content_html : post.content_md;
	const bodyIsHtml = /<(p|div|h[1-6]|ul|ol|li|blockquote|pre|code|table|img|span)\b[\s>]/i.test(
		body,
	);
	const toc = bodyIsHtml ? extractToc(body) : extractMarkdownToc(body);
	// 浏览量乐观显示 +1（本次访问）
	const viewCount = post.view_count + 1;

	return (
		<>
			{/* 顶部阅读进度条（无 transition 避免底部抖动） */}
			<div className="fixed top-0 left-0 right-0 z-50 h-1">
				<div
					className="h-full bg-linear-to-r from-cyan-400 to-blue-500"
					style={{ width: `${progress}%` }}
				/>
			</div>

			<article className="container mx-auto px-6 py-16">
				<BackLink to="/blog" label="博客" className="mb-8" />

				{/* 文章头 */}
				<header className="mx-auto mb-12 max-w-3xl">
					{/* 标签 */}
					{post.tags.length > 0 ? (
						<div className="mb-4 flex flex-wrap gap-2">
							{post.tags.map((tag) => (
								<span
									key={tag}
									className="rounded-full bg-muted px-2.5 py-0.5 font-mono text-xs text-muted-foreground"
								>
									#{tag}
								</span>
							))}
						</div>
					) : null}
					{/* 系列书归属标注 */}
					<SeriesBelonging context={chapterCtx ?? null} />

					<h1 className="mb-3 font-mono text-4xl font-bold leading-tight tracking-tight md:text-5xl">
						{post.title}
					</h1>

					{/* 转载来源（canonical_url 非空时显示，零设计成本的最小可见标记）。
                        显示域名保持视觉简洁，链接 href 仍指完整 canonical_url（两全其美） */}
					{post.canonical_url ? (
						<a
							href={post.canonical_url}
							target="_blank"
							rel="noopener noreferrer external"
							className="mb-5 inline-flex items-center gap-1.5 font-mono text-sm text-muted-foreground transition-colors hover:text-foreground"
						>
							<ExternalLink className="size-3.5" />
							转载自 · {sourceHostname(post.canonical_url)}
						</a>
					) : null}

					{/* 元信息 */}
					<div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-sm text-muted-foreground">
						{post.author ? (
							<span className="inline-flex items-center gap-1.5">
								<AvatarGroup
									users={[post.author, ...(post.collaborators ?? [])]}
									size="sm"
									highlightFirst
								/>
								<span>{post.author.username}</span>
							</span>
						) : null}
						{post.published_at ? (
							<span className="inline-flex items-center gap-1.5">
								<Calendar className="size-3.5" />
								{formatDate(post.published_at)}
							</span>
						) : null}
						<span className="inline-flex items-center gap-1.5">
							<Eye className="size-3.5" />
							{viewCount} 次阅读
						</span>
					</div>
				</header>

				{/* 封面图 */}
				{post.cover_image ? (
					<div
						className="mx-auto mb-9 max-w-4xl overflow-hidden rounded-2xl"
						style={{ viewTransitionName: "post-cover" }}
					>
						<CroppedImage
							src={post.cover_image}
							width={1400}
							alt={post.title}
							className="aspect-2/1 w-full"
						/>
					</div>
				) : null}

				{/* 正文 + TOC */}
				<div className="relative mx-auto flex max-w-6xl justify-center gap-8">
					{/* 左侧 TOC（大屏） */}
					{toc.length > 1 ? (
						<aside className="hidden w-56 shrink-0 2xl:block">
							<div className="sticky top-24">
								<ArticleToc items={toc} contentRef={contentRef} />
							</div>
						</aside>
					) : null}

					{/*
					 * 正文渲染：统一用 body（content_md 优先），
					 * ArticleContent 自动识别 HTML / Markdown 并正确渲染。
					 */}
					<main
						ref={contentRef}
						data-article-content
						onClick={articleImages.bind.onClick}
						onKeyDown={articleImages.bind.onKeyDown}
						className="prose prose-neutral dark:prose-invert min-w-0 max-w-3xl flex-1"
					>
						<ArticleContent content={body} />
					</main>
					{/* 右侧全书目录（挂书文章大屏显示；左层=章内 TOC，右层=全书目录） */}
					{seriesDetail ? (
						<aside className="hidden w-48 shrink-0 lg:block">
							<div className="sticky top-24">
								<p className="text-muted-foreground mb-2 px-2 font-mono text-[10px] tracking-wider uppercase">
									《{seriesDetail.title}》
								</p>
								<SeriesToc detail={seriesDetail} currentSlug={slug} />
							</div>
						</aside>
					) : null}
				</div>

				{/* 上一章/下一章导航（挂书文章显示；对齐正文宽含 TOC 偏移） */}
				{chapterCtx ? (
					<div className="relative mx-auto mt-12 flex max-w-6xl justify-center gap-8">
						{toc.length > 1 ? (
							<aside className="hidden w-56 shrink-0 2xl:block" />
						) : null}
						<div className="min-w-0 max-w-3xl flex-1">
							<ChapterNav context={chapterCtx} />
						</div>
					</div>
				) : null}

				{/* 批注角标 + 气泡层（懒加载：summary 计数渲染角标，点击后按块拉批注） */}
				{commentsEnabled && (
					<Suspense fallback={null}>
						<AnnotationLayer
							contentRef={contentRef}
							summary={summary ?? []}
							postId={post?.id}
							isLoggedIn={isLoggedIn}
						/>
					</Suspense>
				)}

				{/* 划线批注浮动工具条（选区上方浮动，提交后高亮落定） */}
				{post?.id && commentsEnabled && (
					<Suspense fallback={null}>
						<FloatingToolbar
							contentRef={contentRef}
							isLoggedIn={isLoggedIn}
							postId={post.id}
						/>
					</Suspense>
				)}

				{/* 底部自由评论区：放在 article 内、正文+TOC 容器之后，
                    复用同样的 flex 结构保证与正文严格对齐（含大屏 TOC 偏移）。 */}
				{post?.id && commentsEnabled && (
					<div className="relative mx-auto mt-16 flex max-w-6xl justify-center gap-8">
						{toc.length > 1 ? (
							<aside className="hidden w-56 shrink-0 2xl:block" />
						) : null}
						<Suspense
							fallback={
								<div className="min-h-32 w-full max-w-3xl animate-pulse rounded-lg bg-muted/40" />
							}
						>
							<CommentSection postId={post.id} />
						</Suspense>
					</div>
				)}
			</article>

			{/*
			 * 右下角浮动操作区（flex-col 竖列）：目录按钮（仅小屏，大屏用左侧 TOC）+ 返回顶部。
			 * 同一 fixed 容器，避免与全局 MusicPlayer 等右下角元素重叠。
			 */}
			<FloatingBack to="/blog" label="返回博客" />
			{toc.length > 1 || seriesDetail ? (
				<div className="fixed right-8 bottom-8 z-40 flex flex-col items-center gap-3">
					{/* 章内目录：2xl 及以上用左侧固定栏，小屏用浮动按钮 */}
					{toc.length > 1 ? (
						<div className="2xl:hidden">
							<MobileTocFab items={toc} contentRef={contentRef} />
						</div>
					) : null}
					{/* 全书目录：lg 及以上用右侧固定栏，小屏用浮动按钮（两套导航独立入口） */}
					{seriesDetail ? (
						<div className="lg:hidden">
							<MobileSeriesTocFab detail={seriesDetail} currentSlug={slug} />
						</div>
					) : null}
					<BackToTop className="relative" />
				</div>
			) : (
				<BackToTop />
			)}
		</>
	);
}

/** 日期格式化：2026-01-15 → "2026 年 1 月 15 日" */
function formatDate(s: string): string {
	const d = new Date(s);
	if (Number.isNaN(d.getTime())) return s;
	return d.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
}

// sourceHostname 从 canonical URL 提取 hostname 用于转载来源显示。
// URL 非法或无 hostname 时回退到原始字符串（保证总是有可读内容）。
function sourceHostname(canonicalUrl: string): string {
	try {
		const u = new URL(canonicalUrl);
		return u.hostname || canonicalUrl;
	} catch {
		return canonicalUrl;
	}
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
