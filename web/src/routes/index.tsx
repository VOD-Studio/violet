import AnnouncementGrid from "@features/admin-announcements/ui/AnnouncementGrid";
import { githubKeys } from "@features/github/api/keys";
import { fetchContributions, fetchRepos } from "@features/github/api/queries";
import Contributions from "@features/github/ui/Contributions";
import RepoList from "@features/github/ui/RepoList";
import { postKeys } from "@features/posts/api/keys";
import { fetchPosts, usePosts } from "@features/posts/api/queries";
import PostList from "@features/posts/ui/PostList";
import { settingsKeys } from "@features/settings/api/keys";
import { fetchAnnouncements } from "@features/settings/api/queries";
import { ParticleField } from "@shared/ui/particle-field";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";

function HomePage() {
    return (
        <div className="flex flex-col">
            <ParticleField density={0.45} heightVh={80} />

            {/* 着陆区 — 紧凑、有内容，不再浪费全屏 */}
            <LandingHero />

            <section className="container mx-auto flex flex-col gap-32 bg-background px-6 py-32">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                >
                    <h2 className="mb-12 text-3xl font-bold tracking-tight">公告</h2>
                    <AnnouncementGrid />
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                >
                    <h2 className="mb-12 text-3xl font-bold tracking-tight">最新文章</h2>
                    <PostList />
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                >
                    <h2 className="mb-12 text-3xl font-bold tracking-tight">开源贡献</h2>
                    <Contributions />
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                >
                    <h2 className="mb-12 text-3xl font-bold tracking-tight">开源项目</h2>
                    <RepoList />
                </motion.div>
            </section>
        </div>
    );
}

/**
 * LandingHero — 紧凑着陆区
 *
 * 左侧：站点名 + 描述 + CTA
 * 右侧：最新文章预览卡片（md 以上显示）
 * 背景：粒子流 + 渐变光斑 + 网格底纹（透过透明背景可见）
 */
function LandingHero() {
    const { data } = usePosts({});
    const latestPost = data?.data?.[0];

    return (
        <section className="relative overflow-hidden">
            {/* 渐变光斑 */}
            <div className="absolute inset-0 opacity-40 dark:opacity-30">
                <div className="absolute top-1/4 left-1/4 size-96 rounded-full bg-blue-400/30 mix-blend-multiply blur-3xl animate-blob dark:mix-blend-screen" />
                <div className="absolute top-1/3 right-1/4 size-96 rounded-full bg-purple-400/30 mix-blend-multiply blur-3xl animate-blob [animation-delay:2s] dark:mix-blend-screen" />
            </div>

            {/* 网格底纹 */}
            <div
                className="absolute inset-0 text-foreground opacity-[0.03]"
                style={{
                    backgroundImage:
                        "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
                    backgroundSize: "64px 64px",
                    maskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
                    WebkitMaskImage:
                        "radial-gradient(ellipse at center, black 30%, transparent 80%)",
                }}
            />

            <div className="container relative z-10 mx-auto px-4 py-20 md:px-6 md:py-28">
                <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-2">
                    {/* 左：站点标识 */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                    >
                        <h1 className="text-5xl font-black tracking-tighter md:text-7xl">
                            <span className="bg-linear-to-b from-foreground to-foreground/70 bg-clip-text text-transparent">
                                MIMO BLOG
                            </span>
                        </h1>
                        <p className="mt-4 max-w-md text-lg text-muted-foreground">
                            全栈博客平台 · 技术笔记与工程实践
                        </p>

                        <div className="mt-8 flex flex-wrap items-center gap-3">
                            <Link
                                to="/blog"
                                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-105"
                            >
                                浏览博客
                                <ArrowRight className="size-4" />
                            </Link>
                            <Link
                                to="/about"
                                className="inline-flex items-center gap-2 rounded-lg border border-edge-hairline px-5 py-2.5 text-sm font-medium backdrop-blur-sm transition-colors hover:bg-accent"
                                style={{ background: "var(--surface-glass)" }}
                            >
                                关于
                            </Link>
                            <a
                                href="https://github.com"
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex size-10 items-center justify-center rounded-lg border border-edge-hairline text-muted-foreground backdrop-blur-sm transition-colors hover:text-foreground"
                                style={{ background: "var(--surface-glass)" }}
                                aria-label="GitHub"
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    className="size-4 fill-current"
                                    aria-hidden="true"
                                >
                                    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.523 2 12 2z" />
                                </svg>
                                <span className="sr-only">GitHub</span>
                            </a>
                        </div>
                    </motion.div>

                    {/* 右：最新文章预览 */}
                    {latestPost && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                            className="hidden md:block"
                        >
                            <Link
                                to="/blog/$slug"
                                params={{ slug: latestPost.slug }}
                                className="group block overflow-hidden rounded-2xl border border-edge-hairline backdrop-blur-sm transition-all hover:scale-[1.02]"
                                style={{ background: "var(--surface-glass)" }}
                            >
                                <div className="flex flex-col gap-4 p-6">
                                    <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                        Latest
                                    </span>
                                    <h3 className="text-xl font-bold leading-snug transition-colors group-hover:text-neon-blue">
                                        {latestPost.title}
                                    </h3>
                                    <p className="line-clamp-2 text-sm text-muted-foreground">
                                        {latestPost.excerpt}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        {latestPost.tags.slice(0, 3).map((tag) => (
                                            <span
                                                key={tag}
                                                className="rounded-full border border-edge-hairline px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </Link>
                        </motion.div>
                    )}
                </div>
            </div>
        </section>
    );
}

/**
 * / - 首页
 *
 * loader SSR 预取数据：
 * - 文章列表（首屏 + LandingHero 预览）
 * - GitHub 贡献图（底座用）
 *
 * GitHub 贡献图属装饰性次要信息，后端未就绪（如 404）时不应拖垮整页，
 * 故单独 fetch + 容错，失败时底座降级为空（useContributions 自身已是
 * error 降级）。
 */
export const Route = createFileRoute("/")({
    loader: async ({ context }) => {
        // 关键数据：仅文章列表阻塞导航（首屏内容）
        await context.queryClient
            .ensureQueryData({
                queryKey: postKeys.list({}),
                queryFn: () => fetchPosts({}),
            })
            .catch(() => {});

        // 非关键数据：后台预取不阻塞导航，数据到了 UI 响应式更新
        context.queryClient
            .ensureQueryData({
                queryKey: settingsKeys.announcements(),
                queryFn: fetchAnnouncements,
            })
            .catch(() => {});
        context.queryClient
            .ensureQueryData({ queryKey: githubKeys.contributions(), queryFn: fetchContributions })
            .catch(() => {});
        context.queryClient
            .ensureQueryData({ queryKey: githubKeys.repos(), queryFn: fetchRepos })
            .catch(() => {});
    },
    component: HomePage,
});
