/** 进度只统计未删除条目。 */
export interface RoadmapProgress {
	planned: number;
	in_progress: number;
	completed: number;
	total: number;
	/** 已完成占比，0–100 的整数（四舍五入）；空路线图为 0 */
	percent: number;
}

/** 公开项目目录中展示的路线图条目。 */
export interface RoadmapItemPreview {
	id: string;
	/** 项目内条目编号 */
	number: number;
	title: string;
	/** 完成日期，YYYY-MM-DD，不带时区；开发中的条目为 null */
	completion_date: string | null;
}

/** 空路线图也有摘要（进度全 0、无预览）；读取不到摘要时 Project 上没有这个字段。 */
export interface ProjectRoadmapSummary {
	progress: RoadmapProgress;
	/** 现在在做的条目，至多 2 条，按管理员的手动顺序 */
	in_progress: RoadmapItemPreview[];
	/** 最近完成的一条；没有已完成条目时为 null */
	latest_completed: RoadmapItemPreview | null;
}
