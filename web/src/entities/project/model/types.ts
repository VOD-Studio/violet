import type { ProjectRoadmapSummary } from "./roadmap-summary";

/** 项目维护状态；已归档的项目仍可公开查看。 */
export const PROJECT_STATUS_LABELS = {
	active: "进行中",
	stable: "稳定迭代",
	archived: "已归档",
} as const;

export type ProjectStatus = keyof typeof PROJECT_STATUS_LABELS;

/** 公开 GitHub Releases 的正式发布摘要，不含草稿与预发布。 */
export interface ProjectReleaseSummary {
	tag: string;
	/** 实际发布日期，RFC3339。 */
	published_at: string;
	count: number;
	html_url: string;
}

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
	/** 已可访问的 HTTP(S) 或站内文档地址；空串不显示。 */
	docs_url: string;
	status: ProjectStatus;
	/** 技术栈标签列表 */
	tech_stack: string[];
	/** 排序权重，越小越靠前 */
	sort_order: number;
	/** 创建时间，RFC3339 字符串 */
	created_at: string;
	/** 路线图摘要，仅公开项目列表附带；没有这个字段按没有路线图处理 */
	roadmap?: ProjectRoadmapSummary;
	/** 仅在总览查到公开正式发布时附带，不使用路线图的交付版本代替。 */
	release?: ProjectReleaseSummary;
}
