// 文章管理类型定义

/** 文章状态类型 */
export type PostStatus = "draft" | "published";

/** 后端返回的文章结构 */
export interface ApiPost {
  /** 文章唯一标识（UUID 字符串） */
  id: string;
  /** 文章标题 */
  title: string;
  /** URL slug */
  slug: string;
  /** 文章摘要 */
  excerpt?: string;
  /** Markdown 正文内容 */
  contentMarkdown?: string;
  /** 发布状态 */
  status: PostStatus;
  /** 浏览次数 */
  viewCount: number;
  /** 封面图片 */
  coverImage?: string;
  /** SEO 描述 */
  seoDescription?: string;
  /** SEO 关键词 */
  seoKeywords?: string;
  /** 文章标签 */
  tags?: ApiTag[];
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 发布时间 */
  publishedAt?: string | null;
}

/** 标签结构 */
export interface ApiTag {
  /** 标签唯一标识 */
  id: number;
  /** 标签名称 */
  name: string;
  /** URL slug */
  slug: string;
}

/** 热门文章摘要 */
export interface PopularPost {
  /** 文章唯一标识 */
  id: string;
  /** 文章标题 */
  title: string;
  /** URL slug */
  slug: string;
  /** 浏览次数 */
  viewCount: number;
}

/** 最近文章摘要 */
export interface RecentPost {
  /** 文章唯一标识 */
  id: string;
  /** 文章标题 */
  title: string;
  /** URL slug */
  slug: string;
  /** 发布状态 */
  status: PostStatus;
  /** 浏览次数 */
  viewCount: number;
  /** 发布时间 */
  published_at?: string | null;
}

/** 文章列表查询参数 */
export interface PostListParams {
  /** 页码 */
  page?: number;
  /** 每页数量 */
  limit?: number;
  /** 状态筛选 */
  status?: PostStatus;
}

/** 文章列表响应结构 */
export interface PostListResponse {
  /** 文章列表 */
  posts: ApiPost[];
  /** 总数 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页数量 */
  limit: number;
}

/** 创建/更新文章的请求体 */
export interface PostFormData {
  /** 文章标题 */
  title: string;
  /** URL slug（可自定义，不填则自动生成） */
  slug?: string;
  /** Markdown 正文内容 */
  contentMarkdown: string;
  /** 文章摘要 */
  excerpt?: string;
  /** 发布状态 */
  status?: PostStatus;
  /** 标签 ID 列表 */
  tagIds?: number[];
  /** 封面图片 URL */
  coverImage?: string;
  /** SEO 描述 */
  seoDescription?: string;
  /** SEO 关键词 */
  seoKeywords?: string;
}
