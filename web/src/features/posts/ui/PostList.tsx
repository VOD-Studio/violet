import { Skeleton } from "@shared/ui/skeleton";

import { usePosts } from "../api/queries";
import type { PostListQuery } from "../model/types";
import PostCard from "./PostCard";

/**
 * PostListProps - PostList 组件属性
 */
export interface PostListProps {
	/**
	 * 分页与标签筛选
	 */
	query?: PostListQuery;
	/**
	 * 是否显示加载骨架
	 * @default true
	 */
	showSkeleton?: boolean;
}

/**
 * PostList - 文章列表
 *
 * 自动处理三种状态：
 * - 加载中：渲染骨架卡片网格（数量与 limit 对齐）
 * - 错误：渲染错误提示（不抛错，避免整页崩）
 * - 空数据：渲染"暂无文章"
 *
 * 业务页若需自定义 loading/error，可传 showSkeleton=false 自己接管。
 */
const PostList = ({ query = {}, showSkeleton = true }: PostListProps) => {
	const { data, isLoading, isError, error } = usePosts(query);

	if (isLoading && showSkeleton) {
		return (
			<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
				{Array.from({ length: query.limit ?? 6 }).map((_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: 静态骨架列表，顺序固定
					<Skeleton key={i} className="h-72 rounded-lg" />
				))}
			</div>
		);
	}

	if (isError) {
		return (
			<p className="text-center text-muted-foreground py-12">
				加载失败：{error instanceof Error ? error.message : "未知错误"}
			</p>
		);
	}

	if (!data?.data?.length) {
		return <p className="text-center text-muted-foreground py-12">暂无文章</p>;
	}

	return (
		<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{data.data.map((post) => (
				<PostCard key={post.id} post={post} />
			))}
		</div>
	);
};

export default PostList;
