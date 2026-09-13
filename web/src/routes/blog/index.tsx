import { postKeys } from "@features/posts/api/keys";
import { fetchPosts } from "@features/posts/api/queries";
import BlogCascade from "@features/posts/ui/BlogCascade";
import { settingsKeys } from "@features/settings/api/keys";
import { fetchSettings } from "@features/settings/api/queries";
import type { SiteSettings } from "@features/settings/model/types";
import { PageHeader } from "@shared/ui/page-header";
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
	const { limit } = Route.useLoaderData();
	return (
		<PageShell>
			<PageHeader eyebrow="All Posts" title="博客" />
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
