import { postKeys } from "@features/posts/api/keys";
import { fetchPosts } from "@features/posts/api/queries";
import PostList from "@features/posts/ui/PostList";
import { settingsKeys } from "@features/settings/api/keys";
import { fetchSettings, useSettings } from "@features/settings/api/queries";
import type { SiteSettings } from "@features/settings/model/types";
import { PageShell } from "@shared/ui/page-shell";
import { createFileRoute } from "@tanstack/react-router";

/** 默认每页条数：站点设置未加载/未配置时的兜底 */
const DEFAULT_PAGE_SIZE = 12;

/**
 * /blog - 博客列表页
 *
 * 虚拟列表渲染（PostList，大小不一卡片 + 渐隐遮罩）。
 * loader SSR 预取第一页，dehydrate 到 HTML。
 */
function BlogPage() {
	// 每页文章数由站点设置控制（后台「常规设置」）
	const limit = useSettings().data?.posts_per_page ?? DEFAULT_PAGE_SIZE;
	return (
		<PageShell>
			<header className="mb-10">
				<p className="mb-2 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
					All Posts
				</p>
				<h1 className="font-mono text-4xl font-bold">博客</h1>
			</header>
			<PostList query={{ page: 1, limit }} />
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
	},
	component: BlogPage,
});
