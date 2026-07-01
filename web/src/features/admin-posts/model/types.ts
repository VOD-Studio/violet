/**
 * admin-posts 模块类型定义
 *
 * 后台文章管理的写操作请求体与查询参数。领域读模型 PostDetail 见 entities/post，
 * 此处 AdminPost 直接复用，保持后台引用名不变。
 */
import type { PostDetail } from "@entities/post/model/types";

/**
 * AdminPostListQuery - 后台文章列表查询参数
 */
export interface AdminPostListQuery {
    /** 页码，从 1 开始 */
    page?: number;
    /** 每页条数 */
    limit?: number;
    /** 状态筛选，draft / published / archived */
    status?: string;
}

/**
 * CreatePost - 创建文章请求体
 */
export interface CreatePost {
    /** 标题，必填 */
    title: string;
    /** slug，必填 */
    slug: string;
    /** Markdown 正文 */
    content_md?: string;
    /** 渲染后的 HTML 正文 */
    content_html?: string;
    /** 摘要 */
    excerpt?: string;
    /** 封面图 URL */
    cover_image?: string;
    /** SEO 标题 */
    seo_title?: string;
    /** SEO 描述 */
    seo_description?: string;
    /** 标签名列表 */
    tags?: string[];
}

/**
 * UpdatePost - 更新文章请求体
 *
 * 后端复用 createPostRequest 结构，字段与 CreatePost 一致。
 */
export type UpdatePost = CreatePost;

/**
 * UpdatePostStatus - 更新文章状态请求体
 */
export interface UpdatePostStatus {
    /** 目标状态，draft / published / archived */
    status: "draft" | "published" | "archived";
}

/**
 * AdminPost - 后台文章，列表与详情共用 PostDTO 结构
 *
 * 后端 ListAll 与 GetByID 均返回 PostDTO，字段与 PostDetail 一致，
 * 故直接复用 PostDetail 类型。
 */
export type AdminPost = PostDetail;
