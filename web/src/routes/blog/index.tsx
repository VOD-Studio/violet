import { postKeys } from "@features/posts/api/keys";
import { fetchPosts } from "@features/posts/api/queries";
import PostList from "@features/posts/ui/PostList";
import { createFileRoute } from "@tanstack/react-router";

/**
 * /blog - 博客列表页
 *
 * 虚拟列表渲染（PostList，大小不一卡片 + 渐隐遮罩）。
 * loader SSR 预取第一页，dehydrate 到 HTML。
 */
function BlogPage() {
	return (
		<div className="container mx-auto px-4 py-12">
			<header className="mb-10">
				<p className="mb-2 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
					All Posts
				</p>
				<h1 className="font-mono text-4xl font-bold">博客</h1>
			</header>
			<PostList query={{ page: 1, limit: 12 }} />
		</div>
	);
}

export const Route = createFileRoute("/blog/")({
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData({
			queryKey: postKeys.list({ page: 1, limit: 12 }),
			queryFn: () => fetchPosts({ page: 1, limit: 12 }),
		});
	},
	component: BlogPage,
});
