/**
 * Post - 文章摘要（首页列表用）
 *
 * 对接后端 GET /api/v1/posts 返回字段（post 模块的 list DTO）。
 */
export interface Post {
	/** 文章 ID */
	id: string;
	/** slug（用于 URL） */
	slug: string;
	/** 标题 */
	title: string;
	/** 摘要 */
	excerpt: string;
	/** 封面图 URL */
	cover_image: string;
	/** 浏览量 */
	view_count: number;
	/** 发布时间（RFC3339） */
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
 * PostListQuery - 文章列表查询参数
 */
export interface PostListQuery {
	/** 页码（从 1 开始） */
	page?: number;
	/** 每页条数 */
	limit?: number;
	/** 标签筛选 */
	tag?: string;
}

/**
 * PostDetail - 文章详情（按 slug 获取）
 *
 * 对接后端 GET /posts/{slug} 与 GET /admin/posts/{id} 返回的 PostDTO，
 * 字段比列表摘要 Post 多出正文、SEO、状态、时间戳等。
 */
export interface PostDetail {
	/** 文章 ID */
	id: string;
	/** 标题 */
	title: string;
	/** slug（用于 URL） */
	slug: string;
	/** Markdown 正文 */
	content_md: string;
	/** 渲染后的 HTML 正文 */
	content_html: string;
	/** 摘要 */
	excerpt: string;
	/** 封面图 URL */
	cover_image: string;
	/** 状态（draft / published / archived） */
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
	/** 发布时间（RFC3339，草稿可能为空） */
	published_at?: string;
	/** 标签名列表 */
	tags: string[];
	/** 创建时间（RFC3339） */
	created_at: string;
	/** 更新时间（RFC3339） */
	updated_at: string;
}

/**
 * AdminPost - 后台文章（列表与详情共用 PostDTO 结构）
 *
 * 后端 ListAll 与 GetByID 均返回 PostDTO，字段与 PostDetail 一致，
 * 故直接复用 PostDetail 类型。
 */
export type AdminPost = PostDetail;

/**
 * AdminPostListQuery - 后台文章列表查询参数
 */
export interface AdminPostListQuery {
	/** 页码（从 1 开始） */
	page?: number;
	/** 每页条数 */
	limit?: number;
	/** 状态筛选（draft / published / archived） */
	status?: string;
}

/**
 * CreatePost - 创建文章请求体
 */
export interface CreatePost {
	/** 标题（必填） */
	title: string;
	/** slug（必填） */
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
	/** 目标状态（draft / published / archived） */
	status: "draft" | "published" | "archived";
}
