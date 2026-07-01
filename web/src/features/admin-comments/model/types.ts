/**
 * admin-comments 模块类型定义
 *
 * 领域读模型 Comment、AdminComment、CommentPicture、CommentStatus 见 entities/comment，
 * 此处转出供模块内部消费。后台评论管理的查询参数与批量请求体留在本模块。
 */
import type {
    AdminComment,
    Comment,
    CommentPicture,
    CommentStatus,
} from "@entities/comment/model/types";

/**
 * CommentListQuery - 评论列表查询参数
 */
export interface CommentListQuery {
    /** 页码，从 1 开始 */
    page?: number;
    /** 每页条数 */
    limit?: number;
    /** 状态筛选 */
    status?: CommentStatus;
}

/**
 * BatchUpdateCommentsRequest - 批量更新评论状态请求体
 */
export interface BatchUpdateCommentsRequest {
    /** 评论 ID 列表，1-100 条 */
    ids: string[];
    /** 目标状态 */
    status: CommentStatus;
}

// 领域读模型转出
export type { AdminComment, Comment, CommentPicture, CommentStatus };
