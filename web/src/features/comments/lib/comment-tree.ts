/**
 * comments 模块纯逻辑：评论树构建、severity 判定。
 *
 * 这些函数不依赖 React/DOM/TanStack Query，可独立单测。
 */
import type { Comment } from "@entities/comment/model/types";

/** CommentTreeNode 树节点：评论本体 + 嵌套回复 */
export interface CommentTreeNode {
    comment: Comment;
    replies: CommentTreeNode[];
}

/**
 * buildCommentTree - 把扁平评论列表按 parent_id 构建成嵌套树。
 *
 * 用于渲染缩进对话树（PRD-0001：嵌套回复最大深度 4）。
 * 后端通常按 parent_id 一致性返回，但前端防御性处理：
 *   - parent_id 指向列表中不存在的评论 → 降级为顶级节点（不丢失内容）
 *   - 顶级评论（无 parent_id）作为根
 *
 * 时间复杂度 O(n)：两遍遍历，第一遍建 id→node 索引，第二遍挂载子到父。
 */
export const buildCommentTree = (comments: Comment[]): CommentTreeNode[] => {
    // 第一遍：为每条评论建节点，并按 id 索引。
    const nodeById = new Map<string, CommentTreeNode>();
    for (const c of comments) {
        nodeById.set(c.id, { comment: c, replies: [] });
    }

    const roots: CommentTreeNode[] = [];
    // 第二遍：按 parent_id 挂载；父不在列表里则降级为顶级。
    for (const c of comments) {
        // node 必然存在（上一遍刚放进去），用可选链 + continue 兜底防御
        const node = nodeById.get(c.id);
        if (!node) continue;
        if (c.parent_id) {
            const parent = nodeById.get(c.parent_id);
            if (parent) {
                parent.replies.push(node);
                continue;
            }
        }
        roots.push(node);
    }
    return roots;
};

/** CommentSeverity 三态，对应 shadcn 色阶（参考 announcement-severity 结构） */
export type CommentSeverity = "default" | "discussion" | "author";

/**
 * getCommentSeverity - 判定单条评论的视觉 severity。
 *
 * 三态（PRD-0001 高亮配色，跟随 AnnouncementCard 的 shadcn 色阶方向）：
 *   - author：文章 Owner 本人评论（最高优先级，作者高亮色阶）
 *   - discussion：有 ≥1 回复（讨论热度色阶）
 *   - default：无回复的普通评论
 *
 * 优先级：author > discussion > default。
 */
export const getCommentSeverity = (
    node: CommentTreeNode,
    opts: { isAuthor: boolean },
): CommentSeverity => {
    if (opts.isAuthor) return "author";
    if (node.replies.length > 0) return "discussion";
    return "default";
};
