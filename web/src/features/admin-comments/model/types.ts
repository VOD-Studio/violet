/**
 * admin-comments 模块类型定义
 *
 * 对齐后端 application/comment.CommentDTO / AdminCommentDTO。
 */

/** CommentStatus - 评论状态枚举 */
export type CommentStatus = "pending" | "approved" | "spam" | "deleted";

/** Picture - 评论配图 */
export interface Picture {
    /** 图片 URL */
    url: string;
    /** 宽度（px） */
    width: number;
    /** 高度（px） */
    height: number;
    /** 文件大小（字节） */
    size: number;
}

/** CommentDTO - 评论数据传输对象（待审核列表用） */
export interface CommentDTO {
    /** 评论 ID */
    id: string;
    /** 所属文章 ID */
    post_id: string;
    /** 父评论 ID（顶层评论为空） */
    parent_id?: string;
    /** 嵌套深度 */
    depth: number;
    /** 评论人昵称 */
    author_name: string;
    /** 评论人头像 URL */
    avatar_url: string;
    /** 评论正文 */
    body: string;
    /** 配图列表 */
    pictures: Picture[];
    /** 状态 */
    status: CommentStatus;
    /** 创建时间（RFC3339 字符串） */
    created_at: string;
}

/** AdminCommentDTO - 后台评论数据传输对象（含文章信息） */
export interface AdminCommentDTO extends CommentDTO {
    /** 所属文章标题 */
    post_title: string;
    /** 所属文章 slug */
    post_slug: string;
}

/** CommentListQuery - 评论列表查询参数 */
export interface CommentListQuery {
    /** 页码（从 1 开始） */
    page?: number;
    /** 每页条数 */
    limit?: number;
    /** 状态筛选 */
    status?: CommentStatus;
}

/** BatchUpdateCommentsRequest - 批量更新评论状态请求体 */
export interface BatchUpdateCommentsRequest {
    /** 评论 ID 列表（1-100 条） */
    ids: string[];
    /** 目标状态 */
    status: CommentStatus;
}
