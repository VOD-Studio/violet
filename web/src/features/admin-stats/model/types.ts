/** admin-stats 模块类型定义 */

/** 文章摘要（最近发布 / 热门排行共用） */
export interface PostSummaryDTO {
	id: string;
	title: string;
	slug: string;
	/** 'draft' | 'published' | 'archived' */
	status: string;
	view_count: number;
	/** RFC3339；未发布时省略 */
	published_at?: string;
}

/** 后台总览统计（GET /admin/stats） */
export interface DashboardStatsDTO {
	total_posts: number;
	total_comments: number;
	pending_comments: number;
	total_views: number;
	today_views: number;
	yesterday_views: number;
	week_comments: number;
	last_week_comments: number;
	total_users: number;
	recent_posts: PostSummaryDTO[];
	popular_posts: PostSummaryDTO[];
}

/** 浏览量数据点 */
export interface ViewPointDTO {
	/** 日聚合为 YYYY-MM-DD，月聚合为 YYYY-MM */
	label: string;
	count: number;
}

/** 浏览量趋势（GET /admin/stats/views） */
export interface ViewTrendsDTO {
	daily: ViewPointDTO[];
	monthly: ViewPointDTO[];
}
