/**
 * comments 模块类型定义
 *
 * 对接后端 comment / commentreaction 两类 handler。
 * 评论支持嵌套回复与状态机，反应为 emoji 点赞聚合。
 *
 * 字段来源：
 * - CommentDTO / AdminCommentDTO 见 application/comment/service.go，已带 json tag，snake_case。
 * - Reaction / BatchResult 见 domain/commentreaction/entity.go，已带 json tag，snake_case。
 * - Picture 见 domain/comment/entity.go，已带 json tag，snake_case。
 */

/**
 * CommentPicture - 评论附件图片
 *
 * 对应 domain/comment/entity.go 的 Picture。
 */
export interface CommentPicture {
	/** 图片 URL */
	url: string;
	/** 图片宽度，像素 */
	width: number;
	/** 图片高度，像素 */
	height: number;
	/** 图片字节数 */
	size: number;
}

/**
 * Comment - 评论读模型
 *
 * 对应后端 application/comment/service.go 的 CommentDTO，
 * 前台 GET /posts/{postId}/comments 与后台待审核列表共用。
 */
export interface Comment {
	/** 评论 ID */
	id: string;
	/** 所属文章 ID */
	post_id: string;
	/** 父评论 ID，顶级评论省略 */
	parent_id?: string;
	/** 嵌套深度，0 为顶级 */
	depth: number;
	/** 作者昵称 */
	author_name: string;
	/** 作者头像 URL */
	avatar_url: string;
	/** 评论正文 */
	body: string;
	/** 附件图片列表，无图为空数组 */
	pictures: CommentPicture[];
	/** 状态：pending / approved / spam / deleted */
	status: string;
	/** 创建时间，RFC3339 字符串 */
	created_at: string;
}

/**
 * AdminComment - 后台评论读模型，含所属文章信息
 *
 * 对应 application/comment/service.go 的 AdminCommentDTO。
 * 该结构体内嵌 CommentDTO，并额外声明 PostID/PostTitle/PostSlug。
 *
 * 字段冲突说明：内嵌 CommentDTO 与外层都声明了 json:"post_id"。
 * Go encoding/json 在此情况下以外层字段为准，故 post_id 取外层 AdminCommentDTO.PostID，
 * 不会重复序列化，也不会报错。CommentDTO 自身的 post_id 被遮蔽。
 */
export interface AdminComment extends Comment {
	/** 所属文章 ID，覆盖内嵌 CommentDTO.post_id */
	post_id: string;
	/** 所属文章标题 */
	post_title: string;
	/** 所属文章 slug */
	post_slug: string;
}

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
	/** 状态筛选：pending / approved / spam / deleted，省略返回全部 */
	status?: string;
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
	/** 目标状态：pending / approved / spam / deleted */
	status: "pending" | "approved" | "spam" | "deleted";
}

/**
 * PendingCountResponse - 待审核评论数量响应
 *
 * 后端 CountPending 用 RespondOK 返回 map[string]any{"count": count}。
 */
export interface PendingCountResponse {
	/** 待审核评论数量 */
	count: number;
}

/**
 * BatchUpdateStatusResponse - 批量更新状态响应
 *
 * 后端 BatchUpdateStatus 用 RespondOK 返回 map[string]any{"affected": affected}。
 */
export interface BatchUpdateStatusResponse {
	/** 受影响行数 */
	affected: number;
}
