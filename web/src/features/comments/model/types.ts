/**
 * comments 模块类型定义
 *
 * 领域读模型 Comment、CommentPicture、AdminComment、CommentStatus 见 entities/comment，
 * 此处转出供模块内部消费。评论支持嵌套回复与状态机，反应为 emoji 点赞聚合。
 *
 * 字段来源：
 * - Comment / AdminComment 见 application/comment/service.go。
 * - Reaction / BatchResult 见 domain/commentreaction/entity.go。
 */
import type {
    AdminComment,
    Comment,
    CommentPicture,
    CommentStatus,
} from "@entities/comment/model/types";

/**
 * Reaction - 评论反应读模型
 *
 * 对应 domain/commentreaction/entity.go 的 Reaction，
 * 按 emoji 聚合计数后的展示视图。
 */
export interface Reaction {
    /** 反应记录 ID */
    id: number;
    /** 所属评论 ID */
    comment_id: string;
    /** 用户 ID，匿名反应省略 */
    user_id?: string;
    /** 表情 ID */
    emoji_id: number;
    /** 表情名称 */
    emoji_name: string;
    /** 表情图片 URL */
    emoji_url: string;
    /** IP 地址，匿名反应可能携带 */
    ip_address?: string;
    /** 创建时间，RFC3339 字符串 */
    created_at: string;
}

/**
 * BatchReactionResult - 批量反应查询的单条结果
 *
 * 对应 domain/commentreaction/entity.go 的 BatchResult。
 */
export interface BatchReactionResult {
    /** 评论 ID */
    comment_id: string;
    /** 该评论的反应列表 */
    reactions: Reaction[];
}

/**
 * CommentListQuery - 文章评论列表查询参数
 */
export interface CommentListQuery {
    /** 页码，从 1 开始 */
    page?: number;
    /** 每页条数 */
    limit?: number;
}

/**
 * AdminCommentListQuery - 后台评论列表查询参数
 */
export interface AdminCommentListQuery {
    /** 页码，从 1 开始 */
    page?: number;
    /** 每页条数 */
    limit?: number;
    /** 状态筛选，省略返回全部 */
    status?: CommentStatus;
}

/**
 * CreateComment - 提交评论请求体
 *
 * 对应 handler comment.createCommentRequest。
 */
export interface CreateComment {
    /** 评论正文，必填 */
    body: string;
    /** 父评论 ID，顶级评论省略 */
    parent_id?: string;
    /** 作者昵称，必填 */
    author_name: string;
    /** 作者邮箱，必填且需合法格式 */
    author_email: string;
    /** 作者个人站点 URL */
    author_url?: string;
    /** 作者头像 URL */
    avatar_url?: string;
}

/**
 * AddReaction - 添加评论反应请求体
 *
 * 对应 handler commentreaction.AddReaction 内联结构。
 */
export interface AddReaction {
    /** 表情 ID，必填 */
    emoji_id: number;
}

/**
 * BatchReactionsQuery - 批量获取评论反应请求体
 *
 * 对应 handler commentreaction.GetReactionsBatch 内联结构。
 */
export interface BatchReactionsQuery {
    /** 评论 ID 列表，至少一个 */
    comment_ids: string[];
}

/**
 * BatchUpdateCommentStatus - 批量更新评论状态请求体
 *
 * 对应 handler comment.batchUpdateStatusRequest。
 */
export interface BatchUpdateCommentStatus {
    /** 评论 ID 列表，1 到 100 条 */
    ids: string[];
    /** 目标状态 */
    status: CommentStatus;
}

/**
 * PendingCountResponse - 待审核评论数量响应
 *
 * 后端 CountPending 返回 { count }。
 */
export interface PendingCountResponse {
    /** 待审核评论数量 */
    count: number;
}

/**
 * BatchUpdateStatusResponse - 批量更新状态响应
 *
 * 后端 BatchUpdateStatus 返回 { affected }。
 */
export interface BatchUpdateStatusResponse {
    /** 受影响行数 */
    affected: number;
}

// 领域读模型转出
export type { AdminComment, Comment, CommentPicture };
