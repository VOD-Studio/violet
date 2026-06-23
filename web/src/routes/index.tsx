import { githubKeys } from "@features/github/api/keys";
import { fetchContributions } from "@features/github/api/queries";
import Contributions from "@features/github/ui/Contributions";
import { postKeys } from "@features/posts/api/keys";
import { fetchPosts } from "@features/posts/api/queries";
import { settingsKeys } from "@features/settings/api/keys";
import {
	fetchAnnouncements,
	fetchSettings,
} from "@features/settings/api/queries";
import { createFileRoute } from "@tanstack/react-router";
import Hero from "@widgets/Hero";
import ThemeToggle from "@widgets/ThemeToggle";

/**
 * HomePage - 首页根组件（Nexus 80/20 网格）
 *
 * - 上 80%：核心展示区（Hero 内部 50/50）
 * - 下 20%：底座（机械轴体主题切换器极左 + 次要信息 + 贡献图）
 */
function HomePage() {
	return (
		<div className="flex h-[calc(100vh-4rem)] flex-col">
			{/* 80% 核心展示区：左 50% 视觉锚 + 右 50% 动态分发 */}
			<section className="flex-[4] overflow-hidden border-b border-edge-hairline">
				<Hero />
			</section>
			{/* 20% 底座：机械切换器极左 + 次要信息 + 贡献图 */}
			<section className="flex flex-[1] items-stretch gap-4 px-4 py-2">
				<div className="flex items-center">
					<ThemeToggle />
				</div>
				<div className="flex flex-1 items-center justify-center font-mono text-xs text-muted-foreground">
					<span className="hidden md:inline">
						Cmd/Ctrl + K · 60fps · WebGL ready
					</span>
				</div>
				<div className="hidden max-w-md items-center overflow-hidden lg:flex">
					<Contributions />
				</div>
			</section>
		</div>
	);
}

/**
 * / - 首页
 *
 * loader SSR 并发预取四组数据，dehydrate 到 HTML，hydrate 后无额外请求：
 * - 最新文章（HeroRight 用）
 * - GitHub 贡献图（底座用）
 * - 站点配置（Hero 用）
 * - 公告（AnnouncementBar 用）
 *
 * context.queryClient 从 router context 复用（getRouter 注入的单例）。
 */
export const Route = createFileRoute("/")({
	loader: async ({ context }) => {
		await Promise.all([
			context.queryClient.ensureQueryData({
				queryKey: postKeys.list({ page: 1, limit: 8 }),
				queryFn: () => fetchPosts({ page: 1, limit: 8 }),
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
