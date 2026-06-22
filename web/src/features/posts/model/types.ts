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
