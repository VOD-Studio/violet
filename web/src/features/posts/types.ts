/**
 * 文章功能类型定义
 */

/** 文章基本信息 */
export interface Post {
  /** 文章唯一标识 */
  id: string;
  /** 文章标题 */
  title: string;
  /** URL slug */
  slug: string;
  /** 文章摘要 */
  excerpt?: string;
  /** 封面图片 */
  coverImage?: string;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt?: string;
  /** 浏览次数 */
  viewCount: number;
  /** 作者信息 */
  author?: {
    id: string;
    username: string;
    avatar?: string;
  };
  /** 标签列表 */
  tags?: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
}

/** 文章详情，包含正文内容 */
export interface PostDetail extends Post {
  /** Markdown 正文 */
  contentMarkdown?: string;
  /** HTML 正文 */
  contentHtml?: string;
}

/** 分页响应结构 */
export interface PaginatedPosts {
  posts: Post[];
  total: number;
  page: number;
  limit: number;
}

/** 文章列表查询参数 */
export interface PostsParams {
  page?: number;
  limit?: number;
  tag?: string;
  search?: string;
}
