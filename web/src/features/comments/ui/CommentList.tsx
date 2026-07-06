/**
 * CommentList - 评论列表（把扁平评论构建成树后渲染）
 *
 * 消费 buildCommentTree 把扁平 Comment[] 转成嵌套树，
 * 遍历顶级节点用 CommentItem 递归渲染。
 */
import type { Comment } from "@entities/comment/model/types";
import { Button } from "@shared/ui/base/button";
import Empty from "@shared/ui/empty";
import { buildCommentTree } from "../lib/comment-tree";
import { CommentItem } from "./CommentItem";

export interface CommentListProps {
    /** 扁平评论列表（来自 useInfiniteQuery 的 pages 拼接） */
    comments: Comment[];
    /** 文章 id（透传给 CommentItem 的回复表单） */
    postId: string;
    /** 是否登录（透传给 CommentItem，决定是否显示回复按钮） */
    isLoggedIn: boolean;
    /** 加载更多回调（滚动加载下一页）。无更多时为 undefined */
    onLoadMore?: () => void;
    /** 是否正在加载下一页（显示加载态） */
    isLoadingMore?: boolean;
}

export function CommentList({
    comments,
    postId,
    isLoggedIn,
    onLoadMore,
    isLoadingMore = false,
}: CommentListProps) {
    if (comments.length === 0) {
        return <Empty title="还没有评论" description="成为第一个评论的人" size="sm" />;
    }

    const tree = buildCommentTree(comments);
    return (
        <div className="space-y-3">
            {tree.map((node) => (
                <CommentItem
                    key={node.comment.id}
                    node={node}
                    isAuthor={node.comment.is_author}
                    postId={postId}
                    isLoggedIn={isLoggedIn}
                />
            ))}
            {/* 滚动加载更多：手动按钮（IntersectionObserver 自动加载留后续优化） */}
            {onLoadMore && (
                <div className="flex justify-center py-2">
                    <Button variant="ghost" size="sm" onClick={onLoadMore} disabled={isLoadingMore}>
                        {isLoadingMore ? "加载中..." : "加载更多"}
                    </Button>
                </div>
            )}
        </div>
    );
}

export default CommentList;
