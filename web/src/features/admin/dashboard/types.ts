// 仪表盘统计类型定义

import type { RecentPost, PopularPost } from "../posts/types";

/** 每日浏览量数据点 */
export interface DailyView {
  /** 日期 */
  date: string;
  /** 浏览次数 */
  count: number;
}

/** 月度浏览量数据点 */
export interface MonthlyView {
  /** 月份 */
  month: string;
  /** 浏览次数 */
  count: number;
}

/** 浏览量趋势数据结构 */
export interface ViewTrends {
  /** 每日数据 */
  daily: DailyView[];
  /** 月度数据 */
  monthly: MonthlyView[];
}

/** 仪表盘统计数据结构 */
export interface AdminStats {
  /** 文章总数 */
  totalPosts: number;
  /** 评论总数 */
  totalComments: number;
  /** 待审核评论数 */
  pendingComments: number;
  /** 总浏览量 */
  totalViews: number;
  /** 用户总数 */
  totalUsers: number;
  /** 最近文章列表 */
  recentPosts: RecentPost[];
  /** 热门文章列表 */
  popularPosts: PopularPost[];
}

// Re-export types for convenience
export type { RecentPost, PopularPost };
