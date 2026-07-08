import AnnouncementGrid from "@features/admin-announcements/ui/AnnouncementGrid";
import { githubKeys } from "@features/github/api/keys";
import { fetchContributions, fetchRepos } from "@features/github/api/queries";
import Contributions from "@features/github/ui/Contributions";
import RepoList from "@features/github/ui/RepoList";
import { postKeys } from "@features/posts/api/keys";
import { fetchPosts } from "@features/posts/api/queries";
import PostList from "@features/posts/ui/PostList";
import { settingsKeys } from "@features/settings/api/keys";
import { fetchAnnouncements } from "@features/settings/api/queries";
import { ParticleField } from "@shared/ui/particle-field";
import { createFileRoute } from "@tanstack/react-router";
import Hero from "@widgets/Hero";
import { motion } from "motion/react";

function HomePage() {
    return (
        <div className="flex flex-col">
            <ParticleField density={0.45} heightVh={100} />
            <Hero />
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
 * / - 首页
 *
 * loader SSR 预取数据：
 * - GitHub 贡献图（底座用）
 *
 * GitHub 贡献图属装饰性次要信息，后端未就绪（如 404）时不应拖垮整页，
 * 故单独 fetch + 容错，失败时底座降级为空（useContributions 自身已是
 * error 降级）。
 *
 * context.queryClient 从 router context 复用（getRouter 注入的单例）。
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
