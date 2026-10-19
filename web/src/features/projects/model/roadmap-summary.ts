/**
 * 路线图的进度与摘要：项目列表、路线图详情共用。
 *
 * 字段来源 application/project 的 RoadmapSummaryDTO、RoadmapProgressDTO、RoadmapItemPreviewDTO，snake_case。
 * 独立成文件是为了不与 types.ts（项目读模型引用摘要）、roadmap.ts（详情引用项目）互相引用。
 */

/** RoadmapProgress - 进度概览，只统计未删除条目 */
export interface RoadmapProgress {
	planned: number;
	in_progress: number;
	completed: number;
	total: number;
	/** 已完成占比，0–100 的整数（四舍五入）；空路线图为 0 */
	percent: number;
}

/** RoadmapItemPreview - 列表里预览的一条条目 */
export interface RoadmapItemPreview {
	id: string;
	/** 项目内条目编号 */
	number: number;
	title: string;
	/** 完成日期，YYYY-MM-DD，不带时区；开发中的条目为 null */
	completion_date: string | null;
}

/**
 * ProjectRoadmapSummary - 项目列表附带的路线图摘要
 *
 * 没有任何条目的项目也会带着它（进度全 0、没有预览）；读取不到摘要时 Project 上没有这个字段。
 */
export interface ProjectRoadmapSummary {
	progress: RoadmapProgress;
	/** 现在在做的条目，至多 2 条，按管理员的手动顺序 */
	in_progress: RoadmapItemPreview[];
	/** 最近完成的一条；没有已完成条目时为 null */
	latest_completed: RoadmapItemPreview | null;
}
