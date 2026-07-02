import { cn } from "@shared/lib/utils";
import Empty from "@shared/ui/empty";

import { usePosts } from "../api/queries";
import type { PostListQuery } from "../model/types";
import PostCard from "./PostCard";
import PostListSkeleton from "./PostListSkeleton";

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

    const items = [...(data?.data ?? [])].sort(
        (a, b) => Number(b.is_featured) - Number(a.is_featured),
    );

    if (isLoading && showSkeleton) {
        return <PostListSkeleton mixedSizes={mixedSizes} />;
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
                "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start",
                className,
            )}
        >
            {items.map((post, i) => {
                const size = mixedSizes[i % mixedSizes.length] ?? "md";
                return <PostCard key={post.id} post={post} size={size} />;
            })}
        </div>
    );
};

export default PostList;
