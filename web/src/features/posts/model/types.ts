/**
 * posts 模块前台类型
 *
 * 领域读模型 Post、PostDetail 见 entities/post，此处转出供前台 slice 内部消费。
 * 后台写操作与查询类型见 features/admin-posts。
 */
export type { Post, PostDetail } from "@entities/post/model/types";

import type { PageQuery } from "@shared/api/types";

/**
 * PostListQuery - 文章列表查询参数
 */
export interface PostListQuery extends PageQuery {
	/** 标签筛选 */
	tag?: string;
}

/**
 * PostSearchResult - 搜索命中的文章项
 *
 * 对接 GET /posts/search，snippet 为命中上下文片段（非全文）。
 */
export interface PostSearchResult {
	id: string;
	slug: string;
	title: string;
	/** 命中上下文片段（高亮定位用，非全文） */
	snippet: string;
	tags: string[];
	updated_at: string;
}
