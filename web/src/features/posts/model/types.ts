/**
 * 文章浏览的请求与搜索结果；跨 feature 读模型由 entities/post 提供。
 */
export type { Post, PostDetail } from "@entities/post/model/types";

import type { PostBrowseFilter } from "@entities/post/model/types";
import type { PageQuery } from "@shared/api/types";

/** 已发布文章的分页查询；筛选在服务端完整集合上执行。 */
export interface PostListQuery extends PageQuery, PostBrowseFilter {}

/** 当前来源下可见文章的标签选项，不包含草稿或已删除文章。 */
export interface PostTagOption {
	slug: string;
	name: string;
	/** 关联的已发布文章数，单篇文章只计一次。 */
	count: number;
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
