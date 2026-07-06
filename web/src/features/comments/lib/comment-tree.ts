/**
 * comments 模块纯逻辑：评论树构建、severity 判定。
 *
 * 这些函数不依赖 React/DOM/TanStack Query，可独立单测。
 */
import type { Comment } from "@entities/comment/model/types";

/** CommentTreeNode 树节点：评论本体 + 扁平回复列表 */
export interface CommentTreeNode {
    comment: Comment;
    /** 顶层评论下的回复（两层扁平，不深嵌套）。
     *  回复另一条回复时，仍挂同一顶层下，靠 comment.reply_to_name 标对话关系。 */
    replies: CommentTreeNode[];
}

/**
 * buildCommentTree 把扁平评论列表按「两层扁平」组装。
 *
 * 后端 SetParent 已改为两层扁平（depth 只分 0/1）：回复挂顶层下，
 * 回复另一条回复时 depth 还是 1，对话关系靠 comment.reply_to_name 标。
 *
 * 本函数负责把这种结构组装成渲染用的树：
 *   - 顶层评论（无 parent_id）作为根节点
 *   - 回复（有 parent_id）沿 parent_id 链向上找顶层祖先，挂到顶层 replies 下
 *   - 顶层祖先不在列表里（分页/状态过滤）→ 降级为顶层节点（不丢内容）
 *
 * 时间复杂度 O(n)：第一遍建 id→node 索引，第二遍沿 parent_id 链挂载。
 */
export const buildCommentTree = (comments: Comment[]): CommentTreeNode[] => {
    // 第一遍：建 id → node 索引
    const nodeById = new Map<string, CommentTreeNode>();
    for (const c of comments) {
        nodeById.set(c.id, { comment: c, replies: [] });
    }

    const roots: CommentTreeNode[] = [];
    // 第二遍：每条评论找它的顶层祖先，挂到顶层 replies 下。
    for (const c of comments) {
        const node = nodeById.get(c.id);
        if (!node) continue;

        if (!c.parent_id) {
            // 顶层评论，直接进 roots
            roots.push(node);
            continue;
        }

        // 回复：沿 parent_id 链向上找顶层祖先
        const topLevel = findTopAncestor(c, nodeById);
        if (topLevel) {
            topLevel.replies.push(node);
        } else {
            // 顶层祖先不在列表里（分页/状态过滤切走），降级为顶层节点
            roots.push(node);
        }
    }
    return roots;
};

/**
 * findTopAncestor 沿 parent_id 链向上找顶层评论。
 *
 * 回复的 parent_id 可能指：
 *   - 顶层评论（depth=0）→ 直接返回它
 *   - 另一条回复（depth=1）→ 继续沿那条回复的 parent_id 向上
 *
 * 加 visited 集合防环（理论上数据不会成环，防御性编程）。
 * 找不到（链上某个节点不在 nodeById 里）→ 返回 null，调用方降级为顶层。
 */
function findTopAncestor(
    comment: Comment,
    nodeById: Map<string, CommentTreeNode>,
): CommentTreeNode | null {
    let current = comment;
    const visited = new Set<string>();
    while (current.parent_id) {
        if (visited.has(current.id)) return null; // 防环
        visited.add(current.id);
        const parent = nodeById.get(current.parent_id);
        if (!parent) return null; // 链断了，找不到顶层
        if (!parent.comment.parent_id) {
            // parent 是顶层评论
            return parent;
        }
        current = parent.comment;
    }
    return null;
}

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
