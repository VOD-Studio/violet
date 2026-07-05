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
    /** 当前登录用户 id（用于判定「作者本人」高亮；匿名/未登录不传） */
    currentUserId?: string;
    /** 文章 Owner id（用于判定评论是否为作者本人） */
    postAuthorId?: string;
}

export function CommentList({ comments, currentUserId, postAuthorId }: CommentListProps) {
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
                    isAuthor={isAuthorComment(node.comment, currentUserId, postAuthorId)}
                />
            ))}
        </div>
    );
}

/** 判定一条评论是否由文章 Owner 本人发出（作者高亮） */
const isAuthorComment = (
    comment: Comment,
    currentUserId?: string,
    postAuthorId?: string,
): boolean => {
    // 后端 CommentDTO 当前不暴露 user_id 字段（隐私），
    // 前端无法精确判定评论者 == post author。
    // 后续 Issue-0001 补全 is_author 字段后此处接通；
    // 本期保守返回 false（不误高亮），避免错误的作者标记。
    void comment;
    void currentUserId;
    void postAuthorId;
    return false;
};

export default CommentList;
