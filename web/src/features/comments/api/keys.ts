import type { CommentListQuery, ReplyListQuery } from "../model/types";

/**
 * commentKeys - 评论模块 query key 工厂
 *
 * 集中管理前台评论与反应的 key。后台评论管理 key 见 admin-comments。
 */
export const commentKeys = {
    /** 评论模块根 key */
    all: ["comments"] as const,
    /** 前台评论列表维度 */
    lists: () => [...commentKeys.all, "list"] as const,
    /** 具体文章的评论列表 */
    list: (postId: string, query: CommentListQuery) =>
        [...commentKeys.lists(), postId, query] as const,
    /** 批注按块聚合计数（轻量，不含正文） */
    annotationSummary: (postId: string) =>
        [...commentKeys.all, "annotation-summary", postId] as const,
    /** 回复列表维度（按顶层评论 id 聚合） */
    replies: () => [...commentKeys.all, "replies"] as const,
    /** 具体顶层评论的回复列表（含 sort/page 维度） */
    replyList: (commentId: string, query: ReplyListQuery) =>
        [...commentKeys.replies(), commentId, query] as const,
    /** 评论反应维度 */
    reactions: () => [...commentKeys.all, "reactions"] as const,
    /** 具体评论的反应列表 */
    reactionList: (commentId: string) => [...commentKeys.reactions(), commentId] as const,
};
