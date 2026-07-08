import type { PostDetail } from "@entities/post/model/types";
import { useMe } from "@features/auth/api/queries";
import { commentKeys } from "@features/comments/api/keys";
import { fetchAnnotationSummary, useAnnotationSummary } from "@features/comments/api/queries";
import { AnnotationLayer } from "@features/comments/ui/AnnotationLayer";
import { CommentSection } from "@features/comments/ui/CommentSection";
import { FloatingToolbar } from "@features/comments/ui/FloatingToolbar";
import { postKeys } from "@features/posts/api/keys";
import { fetchPostBySlug, usePost } from "@features/posts/api/queries";
import ArticleToc from "@features/posts/ui/ArticleToc";
import MobileTocFab from "@features/posts/ui/MobileTocFab";
import { apiPost } from "@shared/api/request";
import { useArticleImagePreview } from "@shared/lib/hooks/use-article-image-preview";
import { useScrollProgress } from "@shared/lib/hooks/use-scroll-progress";
import { extractToc } from "@shared/lib/hooks/use-toc";
import { extractMarkdownToc } from "@shared/lib/markdown";
import { AvatarGroup } from "@shared/ui/avatar-group";
import { BackToTop } from "@shared/ui/back-to-top";
import { CroppedImage } from "@shared/ui/image-cropper/CroppedImage";
import ArticleContent from "@shared/ui/markdown-preview/ArticleContent";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Calendar, Eye } from "lucide-react";
import { useEffect, useRef } from "react";

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

    // 进入页面增加浏览量（仅一次，失败静默不影响阅读）
    useEffect(() => {
        if (!post?.id) return;
        apiPost(`/posts/${post.id}/view`).catch(() => {
            /* 浏览量统计失败不阻塞阅读 */
        });
    }, [post?.id]);

    if (isLoading) {
        return (
            <div className="container mx-auto px-6 py-32">
                <div className="mx-auto max-w-3xl animate-pulse">
                    <div className="mb-6 h-10 w-3/4 rounded bg-muted" />
                    <div className="mb-8 h-4 w-1/2 rounded bg-muted" />
                    <div className="space-y-3">
                        {[85, 70, 90, 60, 80, 55, 75, 65].map((w) => (
                            <div
                                key={w}
                                className="h-4 rounded bg-muted"
                                style={{ width: `${w}%` }}
                            />
                        ))}
                    </div>
                </div>
            </div>
        );
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
                {/* 返回链接 */}
                <Link
                    to="/blog"
                    className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                    <ArrowLeft className="size-4" />
                    博客
                </Link>

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

                    <h1 className="mb-5 text-4xl font-bold leading-tight tracking-tight md:text-5xl">
                        {post.title}
                    </h1>

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
                        className="mx-auto mb-12 max-w-4xl overflow-hidden rounded-2xl"
                        style={{ viewTransitionName: "post-cover" }}
                    >
                        <CroppedImage
                            src={post.cover_image}
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
                </div>

                {/* 批注角标 + 气泡层（懒加载：summary 计数渲染角标，点击后按块拉批注） */}
                <AnnotationLayer
                    contentRef={contentRef}
                    summary={summary ?? []}
                    postId={post?.id}
                    isLoggedIn={isLoggedIn}
                />

                {/* 划线批注浮动工具条（选区上方浮动，提交后高亮落定） */}
                {post?.id && (
                    <FloatingToolbar
                        contentRef={contentRef}
                        isLoggedIn={isLoggedIn}
                        postId={post.id}
                    />
                )}

                {/* 底部自由评论区：放在 article 内、正文+TOC 容器之后，
                    复用同样的 flex 结构保证与正文严格对齐（含大屏 TOC 偏移）。 */}
                {post?.id && (
                    <div className="relative mx-auto mt-16 flex max-w-6xl justify-center gap-8">
                        {toc.length > 1 ? (
                            <aside className="hidden w-56 shrink-0 2xl:block" />
                        ) : null}
                        <CommentSection postId={post.id} />
                    </div>
                )}
            </article>

            {/* 评论区已上移到 article 内部，与正文对齐 */}

            {articleImages.preview}
            {/*
             * 右下角浮动操作区（flex-col 竖列）：目录按钮（仅小屏，大屏用左侧 TOC）+ 返回顶部。
             * 同一 fixed 容器，避免与全局 MusicPlayer 等右下角元素重叠。
             */}
            {toc.length > 1 ? (
                <div className="fixed right-8 bottom-8 z-40 flex flex-col items-center gap-3">
                    {/* 目录：2xl 及以上用左侧固定栏，小屏用浮动按钮 */}
                    <div className="2xl:hidden">
                        <MobileTocFab items={toc} contentRef={contentRef} />
                    </div>
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

export const Route = createFileRoute("/blog/$slug")({
    loader: async ({ context, params }) => {
        const post = await context.queryClient.ensureQueryData({
            queryKey: postKeys.detail(params.slug),
            queryFn: () => fetchPostBySlug(params.slug),
        });
        // 预取批注聚合计数（轻量，不含正文），首屏 SSR 友好无闪烁。
        // 完整批注按 block_id 在点击角标时懒加载。
        // 自由评论列表由 CommentSection 挂载时拉取（Suspense 兜底）。
        if (post?.id) {
            await context.queryClient.ensureQueryData({
                queryKey: commentKeys.annotationSummary(post.id),
                queryFn: () => fetchAnnotationSummary(post.id),
            });
        }
        return post;
    },
    // 动态 SEO：映射文章的 seo_title / seo_description / 封面图
    head: ({ loaderData }) => {
        const post = loaderData as PostDetail | undefined;
        if (!post) return { meta: [] };
        return {
            meta: [
                { title: post.seo_title || post.title },
                { name: "description", content: post.seo_description || post.excerpt },
                { property: "og:title", content: post.seo_title || post.title },
                { property: "og:description", content: post.seo_description || post.excerpt },
                ...(post.cover_image ? [{ property: "og:image", content: post.cover_image }] : []),
                { property: "og:type", content: "article" },
            ],
        };
    },
    component: BlogDetailPage,
});
