import { postKeys } from "@features/posts/api/keys";
import { fetchPosts } from "@features/posts/api/queries";
import BlogCascade from "@features/posts/ui/BlogCascade";
import { settingsKeys } from "@features/settings/api/keys";
import { fetchSettings } from "@features/settings/api/queries";
import type { SiteSettings } from "@features/settings/model/types";
import { PageShell } from "@shared/ui/page-shell";
import { createFileRoute } from "@tanstack/react-router";

/** 默认每页条数：站点设置未加载/未配置时的兜底 */
const DEFAULT_PAGE_SIZE = 12;

/**
 * /blog - 博客列表页
 *
 * 主轴瀑布渲染（BlogCascade，blog-lab 选型方向）：
 * 最新一篇全宽主轴 + 其余自然高度瀑布流。
 * loader SSR 预取第一页，dehydrate 到 HTML。
 */
function BlogPage() {
	// limit 由 loader 解析（settings 已就绪）经 loaderData 传入：
	// 组件若自行从 useSettings 推导，hydration 首帧 settings 缓存为空
	// 会先用兜底值发一次请求、设置到达再发一次（双请求根因）
	const { limit } = Route.useLoaderData();
	return (
		<PageShell>
			<header className="mb-10">
				<p className="mb-2 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
					All Posts
				</p>
				<h1 className="font-mono text-4xl font-bold">博客</h1>
			</header>
			<BlogCascade limit={limit} />
		</PageShell>
	);
}

export const Route = createFileRoute("/blog/")({
	loader: async ({ context }) => {
		const qc = context.queryClient;
		// 先取站点设置，用 posts_per_page 作为列表 limit（与组件 queryKey 对齐）
		await qc
			.ensureQueryData({ queryKey: settingsKeys.public(), queryFn: fetchSettings })
			.catch(() => {});
		const limit =
			qc.getQueryData<SiteSettings>(settingsKeys.public())?.posts_per_page ??
			DEFAULT_PAGE_SIZE;
		await qc.ensureQueryData({
			queryKey: postKeys.list({ page: 1, limit }),
			queryFn: () => fetchPosts({ page: 1, limit }),
		});
		return { limit };
	},
	component: BlogPage,
});
