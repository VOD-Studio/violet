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
import type { CommentType } from "@features/comments/model/types";

/**
 * CommentListQuery - 评论列表查询参数
 *
 * type 字段控制 anchor 维度筛选（free/annotation/all），
 * 与前台 comments 模块共用 CommentType 字面量联合，API 语义全站统一。
 */
export interface CommentListQuery {
	/** 页码，从 1 开始 */
	page?: number;
	/** 每页条数 */
	limit?: number;
	/** 状态筛选 */
	status?: CommentStatus;
	/** anchor 维度筛选（free/annotation/all）；后台默认 all（不传由后端兜底） */
	type?: CommentType;
}

// 领域读模型转出
// 复用前台 CommentType，避免重复定义
export type { AdminComment, Comment, CommentPicture, CommentStatus, CommentType };

/**
 * BatchUpdateCommentsRequest - 批量更新评论状态请求体
 */
export interface BatchUpdateCommentsRequest {
	/** 评论 ID 列表，1-100 条 */
	ids: string[];
	/** 目标状态 */
	status: CommentStatus;
}
