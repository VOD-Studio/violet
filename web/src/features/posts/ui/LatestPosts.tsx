import { BlogSkeleton } from "@features/lab/blog/ui/BlogSkeleton";
import { WovenBento } from "@features/lab/blog/ui/WovenBento";
import Empty from "@shared/ui/empty";
import { usePosts } from "../api/queries";
import type { PostListQuery } from "../model/types";

/**
 * LatestPosts - 首页「最新文章」（织纹 Bento 方向）
 *
 * blog-lab 织纹方向选型落生产：确定性跨格节奏（6 篇恰好铺满
 * 4 列 × 3 行，面积守恒零留白），骨架/错误/空三态齐备。
 * 排序与列表页一致：精选置顶，其余按返回序。
 */
export default function LatestPosts({ query = {} }: { query?: PostListQuery }) {
	const { data, isLoading, isError, error } = usePosts(query);

	const items = [...(data?.data ?? [])].sort(
		(a, b) => Number(b.is_featured) - Number(a.is_featured),
	);

	if (isLoading) {
		return <BlogSkeleton direction="bento" />;
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

	return <WovenBento posts={items} />;
}
