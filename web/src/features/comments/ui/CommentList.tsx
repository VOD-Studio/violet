/**
 * CommentList - 评论列表（把扁平评论构建成树后渲染）
 *
 * 消费 buildCommentTree 把扁平 Comment[] 转成嵌套树，
 * 遍历顶级节点用 CommentItem 递归渲染。
 */
import type { Comment } from "@entities/comment/model/types";
import Empty from "@shared/ui/empty";
import { buildCommentTree } from "../lib/comment-tree";
import { CommentItem } from "./CommentItem";

export interface CommentListProps {
    /** 扁平评论列表（来自 useComments） */
    comments: Comment[];
    /** 文章 id（透传给 CommentItem 的回复表单） */
    postId: string;
    /** 是否登录（透传给 CommentItem，决定是否显示回复按钮） */
    isLoggedIn: boolean;
}

export function CommentList({ comments, postId, isLoggedIn }: CommentListProps) {
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
        </div>
    );
}

export default CommentList;
