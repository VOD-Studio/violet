import type { PostDetail } from "@entities/post/model/types";
import { postKeys } from "@features/posts/api/keys";
import { fetchPostBySlug, usePost } from "@features/posts/api/queries";
import ArticleToc from "@features/posts/ui/ArticleToc";
import { useScrollProgress } from "@shared/lib/hooks/use-scroll-progress";
import { extractToc } from "@shared/lib/hooks/use-toc";
import { extractMarkdownToc } from "@shared/lib/markdown";
import { markdownComponents } from "@shared/ui/markdown-preview/components/markdown-components";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Calendar, Eye } from "lucide-react";
import { useRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

/**
 * /blog/$slug - 文章详情页
 *
 * loader SSR 预取文章（按 slug），组件读缓存。
 *
 * 正文支持双渲染：
 * - 优先 content_html（后端预渲染 HTML，SSR 友好，dangerouslySetInnerHTML 直出）
 * - fallback content_md（react-markdown + rehype-slug 客户端渲染，复用 markdownComponents）
 *
 * TOC 同步双源：有 content_html 时从 HTML 提取（标题已带 id），
 * 否则从 content_md 提取（github-slugger 生成 id，与 rehype-slug 一致）。
 * 路由 head 映射 SEO 字段（title/description/og:image）。
 */
function BlogDetailPage() {
    const { slug } = Route.useParams();
    const { data: post, isLoading, error } = usePost(slug);
    const contentRef = useRef<HTMLElement>(null);
    const progress = useScrollProgress();

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

    // 双渲染判定：有可用 HTML（非空且看起来像 HTML）则直出，否则用 markdown
    const hasHtml = post.content_html && post.content_html.trim().length > 0;
    const useHtml = hasHtml && /<[a-z][\s\S]*>/i.test(post.content_html);
    // TOC：HTML 优先（标题已带 id），否则从 markdown 提取
    const toc = useHtml ? extractToc(post.content_html) : extractMarkdownToc(post.content_md);

    return (
        <>
            {/* 顶部阅读进度条 */}
            <div className="fixed top-0 left-0 right-0 z-50 h-1">
                <div
                    className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-[width] duration-150"
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
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                        {post.published_at ? (
                            <span className="inline-flex items-center gap-1.5">
                                <Calendar className="size-3.5" />
                                {formatDate(post.published_at)}
                            </span>
                        ) : null}
                        <span className="inline-flex items-center gap-1.5">
                            <Eye className="size-3.5" />
                            {post.view_count} 次阅读
                        </span>
                    </div>
                </header>

                {/* 封面图 */}
                {post.cover_image ? (
                    <div className="mx-auto mb-12 max-w-4xl overflow-hidden rounded-2xl">
                        <img
                            src={post.cover_image}
                            alt={post.title}
                            className="aspect-[2/1] w-full object-cover"
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

                    {/* 正文：优先 content_html 直出，否则 react-markdown 渲染 content_md */}
                    <main
                        ref={contentRef}
                        className="prose prose-neutral dark:prose-invert min-w-0 max-w-3xl flex-1"
                    >
                        {useHtml ? (
                            <div
                                // biome-ignore lint/security/noDangerouslySetInnerHtml: 后端/编辑器预渲染的 HTML 正文
                                dangerouslySetInnerHTML={{ __html: post.content_html }}
                            />
                        ) : (
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                rehypePlugins={[rehypeSlug]}
                                components={markdownComponents}
                            >
                                {post.content_md}
                            </ReactMarkdown>
                        )}
                    </main>
                </div>
            </article>
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
