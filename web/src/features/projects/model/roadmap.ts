/**
 * 项目路线图读模型，对接 GET /projects/by-slug/{slug}/roadmap。
 *
 * 字段来源 application/roadmap 的 DetailDTO、ItemDTO、RelationDTO，snake_case。
 * 写接口的请求体随后续票补充。
 */
import type { Project } from "./types";

/** 条目所处阶段；阶段只由管理员手动设置，关系不会改变它。 */
export type RoadmapStage = "planned" | "in_progress" | "completed";

/** 条目的关联链接。 */
export interface RoadmapLink {
	label: string;
	url: string;
}

/**
 * RoadmapItem - 路线图条目
 *
 * 后端按阶段与展示顺序给出（计划中、进行中按位置，已完成按完成日期倒序、同日按编号倒序），
 * 前端不再排序。
 */
export interface RoadmapItem {
	/** 条目 ID，UUID 字符串 */
	id: string;
	project_id: string;
	/** 项目内自增且永不复用的编号 */
	number: number;
	title: string;
	/** 纯文本简介，可含换行，可为空串 */
	description: string;
	stage: RoadmapStage;
	/** 分数索引排序键，仅后端排序用 */
	position: string;
	/** 条目标签，自由文本；读取层已把 null 规整为空数组 */
	tags: string[];
	/** 关联链接；读取层已把 null 规整为空数组 */
	links: RoadmapLink[];
	/** 完成日期，YYYY-MM-DD，不带时区；未完成为 null */
	completion_date: string | null;
	/** 交付版本，仅已完成条目有，可为空串 */
	delivered_version: string;
	/** 存在未完成的阻塞前置条目，派生标记，不改变阶段 */
	blocked: boolean;
	created_at: string;
	updated_at: string;
}

/** 关系类型：扩展、修复、阻塞；方向读作「来源 类型 目标」。 */
export type RoadmapRelationType = "extends" | "fixes" | "blocks";

/** RoadmapRelation - 同一项目内两个条目之间带类型的有向关系 */
export interface RoadmapRelation {
	id: string;
	project_id: string;
	source_id: string;
	target_id: string;
	type: RoadmapRelationType;
	created_at: string;
}

/** RoadmapProgress - 进度概览，只统计未删除条目 */
export interface RoadmapProgress {
	planned: number;
	in_progress: number;
	completed: number;
	total: number;
	/** 已完成占比，0–100 的整数（四舍五入）；空路线图为 0 */
	percent: number;
}

/** RoadmapDetail - 公开路线图详情：项目、全部条目、关系与进度 */
export interface RoadmapDetail {
	project: Project;
	items: RoadmapItem[];
	relations: RoadmapRelation[];
	progress: RoadmapProgress;
}
