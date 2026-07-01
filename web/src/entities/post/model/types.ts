/**
 * Post 与 PostDetail - 文章领域实体
 *
 * 前台展示与后台管理共享的读模型，跨 feature 复用故归 entities 层，
 * 放置惯例对齐 entities/user。
 */

/**
 * Post - 文章摘要，首页列表用
 *
 * 对接后端 GET /api/v1/posts 返回字段，post 模块的 list DTO。
 */
export interface Post {
    /** 文章 ID */
    id: string;
    /** slug，用于 URL */
    slug: string;
    /** 标题 */
    title: string;
    /** 摘要 */
    excerpt: string;
    /** 封面图 URL */
    cover_image: string;
    /** 浏览量 */
    view_count: number;
    /** 发布时间，RFC3339 */
    published_at: string;
    /** 标签名列表 */
    tags: string[];
    /** 作者信息 */
    author: {
        /** 作者用户名 */
        username: string;
        /** 作者头像 URL */
        avatar_url: string;
    };
}

/**
 * PostDetail - 文章详情，按 slug 或后台 ID 获取
 *
 * 对接后端 GET /posts/{slug} 与 GET /admin/posts/{id} 返回的 PostDTO，
 * 字段比列表摘要 Post 多出正文、SEO、状态、时间戳等。
 */
export interface PostDetail {
    /** 文章 ID */
    id: string;
    /** 标题 */
    title: string;
    /** slug，用于 URL */
    slug: string;
    /** Markdown 正文 */
    content_md: string;
    /** 渲染后的 HTML 正文 */
    content_html: string;
    /** 摘要 */
    excerpt: string;
    /** 封面图 URL */
    cover_image: string;
    /** 状态，draft / published / archived */
    status: string;
    /** 作者 ID */
    author_id: string;
    /** 浏览量 */
    view_count: number;
    /** 是否精选 */
    is_featured: boolean;
    /** SEO 标题 */
    seo_title: string;
    /** SEO 描述 */
    seo_description: string;
    /** 发布时间，RFC3339，草稿可能为空 */
    published_at?: string;
    /** 标签名列表 */
    tags: string[];
    /** 创建时间，RFC3339 */
    created_at: string;
    /** 更新时间，RFC3339 */
    updated_at: string;
}
