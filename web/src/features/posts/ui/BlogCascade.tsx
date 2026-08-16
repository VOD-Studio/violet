import { BlogSkeleton } from "@features/lab/blog/ui/BlogSkeleton";
import { CascadeFlow } from "@features/lab/blog/ui/CascadeFlow";
import Empty from "@shared/ui/empty";
import { usePosts } from "../api/queries";
import type { PostListQuery } from "../model/types";

/**
 * BlogCascade - 博客列表页（主轴瀑布方向）
 *
 * blog-lab 主轴瀑布选型落生产：最新一篇全宽主轴（封面 + 渐变遮罩 +
 * 大字浮排），其余 CSS columns 自然高度瀑布流，无封面退化为排版卡。
 * 数据/骨架/错误/空四态，排序与首页一致（精选置顶）。
 */
export default function BlogCascade({ query = {} }: { query?: PostListQuery }) {
	const { data, isLoading, isError, error } = usePosts(query);

	const items = [...(data?.data ?? [])].sort(
		(a, b) => Number(b.is_featured) - Number(a.is_featured),
	);

	if (isLoading) {
		return <BlogSkeleton direction="cascade" />;
	}

	if (isError) {
		return (
			<Empty
				title="加载失败"
				description={error instanceof Error ? error.message : "未知错误"}
				className="py-20"
			/>
		);
	}

	if (!items.length) {
		return <Empty title="暂无文章" description="还没有发布任何内容" className="py-20" />;
	}

	return <CascadeFlow posts={items} />;
}
