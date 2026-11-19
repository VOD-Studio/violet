import type { ProjectRoadmapSummary } from "./roadmap-summary";

/** 对应后端 ProjectDTO，列表与详情共用。 */
export interface Project {
	/** 项目 ID，UUID 字符串 */
	id: string;
	/** 项目标题 */
	title: string;
	slug: string;
	/** 项目描述 */
	description: string;
	/** 项目主页 URL */
	url: string;
	/** GitHub 仓库 URL */
	github_url: string;
	/** 封面图 URL */
	image_url: string;
	/** 技术栈标签列表 */
	tech_stack: string[];
	/** 排序权重，越小越靠前 */
	sort_order: number;
	/** 创建时间，RFC3339 字符串 */
	created_at: string;
	/** 路线图摘要，仅公开项目列表附带；没有这个字段按没有路线图处理 */
	roadmap?: ProjectRoadmapSummary;
}
