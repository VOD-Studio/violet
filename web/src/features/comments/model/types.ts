/**
 * comments 模块类型定义
 *
 * 领域读模型 Comment、CommentPicture、AdminComment 见 entities/comment，
 * 此处转出供模块内部消费。评论支持嵌套回复，反应为 emoji 点赞聚合。
 *
 * 字段来源：
 * - Comment / AdminComment 见 application/comment/service.go。
 * - Reaction / BatchResult 见 domain/commentreaction/entity.go。
 */
import type { AdminComment, Comment, CommentPicture } from "@entities/comment/model/types";

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
 * CreateComment - 提交评论请求体
 *
 * 对应 handler comment.createCommentRequest。双轨认证（PRD-0001）：
 *   - 登录态：忽略 author_name/author_email/code（后端从 user 资料填充），仅 body 必填
 *   - 匿名态：author_name/author_email/code 必填（邮箱验证码两步流）
 */
export interface CreateComment {
    /** 评论正文，必填（纯文本 + emoji） */
    body: string;
    /** 父评论 ID；非空表示嵌套回复 */
    parent_id?: string;
    /** 作者昵称。匿名必填；登录态由后端从 user 资料覆盖，前端可不传 */
    author_name?: string;
    /** 作者邮箱。匿名必填且需合法格式；登录态由后端覆盖 */
    author_email?: string;
    /** 作者个人站点 URL（匿名可选） */
    author_url?: string;
    /** 作者头像 URL（匿名可选） */
    avatar_url?: string;
    /** 匿名必填：邮箱验证码（来自 POST /posts/{postId}/comments/code）。登录态忽略 */
    code?: string;
    /** 选区批注锚点（snake_case 外部契约）；非空时强制登录，自由评论省略 */
    anchor?: {
        block_id: string;
        start_offset: number;
        end_offset: number;
        selected_text: string;
        block_text_hash: string;
    };
}

/**
 * SendCodeBody - 匿名评论发送验证码请求体
 *
 * 对应 POST /posts/{postId}/comments/code 的 body（handler comment.sendCodeRequest）。
 */
export interface SendCodeBody {
    /** 接收验证码的邮箱，必填且需合法格式 */
    email: string;
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

// 领域读模型转出
export type { AdminComment, Comment, CommentPicture };
