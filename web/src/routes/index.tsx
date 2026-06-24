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

function HomePage() {
	return (
		// min-h-0 让内部 flex 比例可分配；80/20 用 flex-[4]/flex-[1]
		// （Tailwind v4 无 flex-4 默认类，必须用任意值语法）
		<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
			{/* 80% 区：作为 flex 容器，Hero 用 flex-1 撑满（不依赖 h-full/父级定高） */}
			<section className="flex min-h-0 flex-[4] flex-col overflow-hidden border-b border-edge-hairline">
				<Hero />
			</section>
			<section className="flex min-h-0 flex-[1] items-stretch gap-4 overflow-hidden px-4 py-2">
				<div className="flex flex-1 items-center justify-center gap-6 font-mono text-xs text-muted-foreground">
					<span className="hidden md:inline">Cmd/Ctrl + K</span>
					<span className="hidden md:inline">60fps · WebGL ready</span>
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
 * GitHub 贡献图属装饰性次要信息，后端未就绪（如 404）时不应拖垮整页，
 * 故单独 fetch + 容错，失败时底座降级为空（useContributions 自身已是
 * error 降级）。其余三组保持 fail-fast（核心内容）。
 *
 * context.queryClient 从 router context 复用（getRouter 注入的单例）。
 */
export const Route = createFileRoute("/")({
	loader: async ({ context }) => {
		// 核心三组：fail-fast，任一失败 → 路由 errorComponent / 上抛
		await Promise.all([
			context.queryClient.ensureQueryData({
				queryKey: postKeys.list({ page: 1, limit: 8 }),
				queryFn: () => fetchPosts({ page: 1, limit: 8 }),
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

		// 装饰性：单独预取，失败不阻塞（catch 后缓存为空，底座自然降级）
		await context.queryClient
			.ensureQueryData({
				queryKey: githubKeys.contributions(),
				queryFn: fetchContributions,
			})
			.catch(() => {
				/* GitHub 端点未就绪（404 等）→ 贡献区降级，不影响主页 */
			});
	},
	component: HomePage,
});
