/**
 * Comment 系列 - 评论领域实体
 *
 * 前台评论展示与后台评论管理共享的读模型，跨 feature 复用故归 entities 层，
 * 放置惯例对齐 entities/user、entities/post。
 * 原 comments/Comment 与 admin-comments/CommentDTO 字段一致，本次合并统一。
 */

/** 评论状态机 */
export type CommentStatus = "pending" | "approved" | "spam" | "deleted";

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
    /** 状态 */
    status: CommentStatus;
    /** 创建时间，RFC3339 字符串 */
    created_at: string;
}

/**
 * AdminComment - 后台评论读模型，含所属文章信息
 *
 * 对应 application/comment/service.go 的 AdminCommentDTO。
 * post_id 继承自 Comment。
 */
export interface AdminComment extends Comment {
    /** 所属文章标题 */
    post_title: string;
    /** 所属文章 slug */
    post_slug: string;
}
