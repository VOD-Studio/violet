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
    /** 是否精选 */
    is_featured?: boolean;
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
 * SetFeatured - 切换精选标记请求体
 */
export interface SetFeatured {
    /** 是否精选 */
    is_featured: boolean;
}

/**
 * AdminPostListItem - 后台文章列表项
 *
 * 后端 ListAll 返回 PostListItemDTO（不含正文，避免响应过大），
 * 字段比详情 AdminPost 精简，故单独建模。
 */
export interface AdminPostListItem {
    /** 文章 ID */
    id: string;
    /** slug */
    slug: string;
    /** 标题 */
    title: string;
    /** 摘要 */
    excerpt: string;
    /** 封面图 URL */
    cover_image: string;
    /** 状态 */
    status: string;
    /** 是否精选 */
    is_featured: boolean;
    /** 浏览量 */
    view_count: number;
    /** 发布时间，RFC3339，草稿可能为空 */
    published_at?: string;
    /** 标签名列表 */
    tags: string[];
    /** 作者信息，缺失时省略 */
    author?: { username: string; avatar_url: string };
}

/**
 * AdminPost - 后台文章详情
 *
 * 后端 GetByID 返回完整 PostDTO，字段与 PostDetail 一致，故直接复用。
 * 列表用 AdminPostListItem，勿混用。
 */
export type AdminPost = PostDetail;

/**
 * PostVersionDTO - 文章历史版本
 */
export interface PostVersionDTO {
    id: string;
    post_id: string;
    title: string;
    content_md?: string;
    tags: string[];
    /** 编辑这一版的操作人 ID */
    editor_id: string;
    /** 编辑者信息（用户名+头像），后端按 editor_id 批量填充 */
    editor?: { username: string; avatar_url: string };
    summary: string;
    created_at: string;
}
