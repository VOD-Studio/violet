/**
 * Admin Stats 模块类型定义
 *
 * 对接后端 admin 统计接口，字段 snake_case 对齐 Go 结构体 json tag，
 * time 字段统一为 string。后端定义见 api/internal/domain/stats/entity.go。
 */

/**
 * PostSummary 后台文章摘要
 *
 * 对应后端 domain/stats.PostSummary，用于 recent_posts 与 popular_posts。
 */
export interface PostSummary {
	/** 文章 ID */
	id: string;
	/** 标题 */
	title: string;
	/** slug，用于 URL */
	slug: string;
	/** 状态，如 published/draft */
	status: string;
	/** 浏览量 */
	view_count: number;
	/** 发布时间，RFC3339 字符串，未发布时省略 */
	published_at?: string;
}

/**
 * DashboardStats 仪表盘总览统计
 *
 * 对接后端 GET /admin/stats 返回结构 domain/stats.DashboardStats。
 */
export interface DashboardStats {
	/** 文章总数 */
	total_posts: number;
	/** 评论总数 */
	total_comments: number;
	/** 待审评论数 */
	pending_comments: number;
	/** 总浏览量 */
	total_views: number;
	/** 用户总数 */
	total_users: number;
	/** 最近文章列表 */
	recent_posts: PostSummary[];
	/** 热门文章列表 */
	popular_posts: PostSummary[];
}

/**
 * ViewPoint 浏览量数据点
 *
 * label 为日期 YYYY-MM-DD 或月份 YYYY-MM，取决于所属序列。
 */
export interface ViewPoint {
	/** 时间标签，日期或月份字符串 */
	label: string;
	/** 该时间点的浏览量 */
	count: number;
}

/**
 * ViewTrends 浏览量趋势
 *
 * 对接后端 GET /admin/stats/views 返回结构 domain/stats.ViewTrends。
 */
export interface ViewTrends {
	/** 按日聚合的浏览量序列 */
	daily: ViewPoint[];
	/** 按月聚合的浏览量序列 */
	monthly: ViewPoint[];
}
