import { githubKeys } from "@features/github/api/keys";

import { fetchContributions } from "@features/github/api/queries";
import Contributions from "@features/github/ui/Contributions";
import { postKeys } from "@features/posts/api/keys";
import { fetchPosts } from "@features/posts/api/queries";
import PostList from "@features/posts/ui/PostList";
import { settingsKeys } from "@features/settings/api/keys";
import {
	fetchAnnouncements,
	fetchSettings,
} from "@features/settings/api/queries";
import { createFileRoute } from "@tanstack/react-router";
import Hero from "@widgets/Hero";

/**
 * HomePage - 首页根组件
 *
 * Hero（react-bbits 三组件）+ 最新 6 篇文章 + GitHub 贡献图。
 */
function HomePage() {
	return (
		<>
			<Hero />
			<section className="container mx-auto px-4 py-16">
				<h2 className="text-3xl font-bold mb-8">最新文章</h2>
				<PostList query={{ page: 1, limit: 6 }} />
			</section>
			<section className="container mx-auto px-4 py-16">
				<h2 className="text-3xl font-bold mb-8">GitHub 活动</h2>
				<Contributions />
			</section>
		</>
	);
}

/**
 * / - 首页
 *
 * loader SSR 并发预取四组数据，dehydrate 到 HTML，hydrate 后无额外请求：
 * - 最新 6 篇文章
 * - GitHub 贡献图
 * - 站点配置（Hero 用）
 * - 公告（AnnouncementBar 用）
 *
 * context.queryClient 从 router context 复用（getRouter 注入的单例）。
 */
export const Route = createFileRoute("/")({
	loader: async ({ context }) => {
		await Promise.all([
			context.queryClient.ensureQueryData({
				queryKey: postKeys.list({ page: 1, limit: 6 }),
				queryFn: () => fetchPosts({ page: 1, limit: 6 }),
			}),
			context.queryClient.ensureQueryData({
				queryKey: githubKeys.contributions(),
				queryFn: fetchContributions,
			}),
			context.queryClient.ensureQueryData({
				queryKey: settingsKeys.public(),
				queryFn: fetchSettings,
			}),
			context.queryClient.ensureQueryData({
				queryKey: settingsKeys.announcements(),
				queryFn: fetchAnnouncements,
			}),
		]);
	},
	component: HomePage,
});
