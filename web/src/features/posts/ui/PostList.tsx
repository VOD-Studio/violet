import { cn } from "@shared/lib/utils";
import Empty from "@shared/ui/empty";
import Loader from "@shared/ui/loader";

import { usePosts } from "../api/queries";
import type { PostListQuery } from "../model/types";
import PostCard from "./PostCard";

export interface PostListProps {
	query?: PostListQuery;
	showSkeleton?: boolean;
	mixedSizes?: ("sm" | "md" | "lg")[];
	className?: string;
}

const PostList = ({
	query = {},
	showSkeleton = true,
	mixedSizes = ["md", "md", "lg"],
	className,
}: PostListProps) => {
	const { data, isLoading, isError, error } = usePosts(query);

	const items = data?.data ?? [];

	if (isLoading && showSkeleton) {
		return <Loader label="加载文章…" className="py-20" />;
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

	return (
		<div
			className={cn(
				"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-[240px]",
				className,
			)}
		>
			{items.map((post, i) => {
				const size = mixedSizes[i % mixedSizes.length] ?? "md";
				// Define bento grid spans based on size
				const spanClass =
					size === "lg"
						? "md:col-span-2 md:row-span-2"
						: size === "md"
							? "md:row-span-2"
							: "md:row-span-1";
				return (
					<div key={post.id} className={spanClass}>
						<PostCard post={post} size={size} />
					</div>
				);
			})}
		</div>
	);
};

export default PostList;
