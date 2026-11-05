import manifest from "@violet/ui/component-manifest.json";
import type { ComponentType } from "react";

/** 按占地划分的展区，决定展品陈列在哪间展厅。 */
export type Zone = "banner" | "stage" | "shelf" | "field" | "content";

/** 按用途划分的类别，只用作筛选。 */
export type Category =
	| "action"
	| "form"
	| "navigation"
	| "overlay"
	| "feedback"
	| "display"
	| "content"
	| "layout";

/** 展品静止态与展开态所需的最小舞台空间，单位 px。 */
export interface Footprint {
	width: number;
	height: number;
}

/** 检视台里可切换的一种状态。 */
export interface ExhibitState {
	/** 传给展品渲染函数的取值 */
	id: string;
	label: string;
}

/** 展品渲染函数的参数。 */
export interface ExhibitRenderProps {
	/** 当前状态的 id；展柜里固定为第一种状态 */
	state: string;
}

/** 一个组件单元在陈列室里的陈列。 */
export interface Exhibit {
	/** URL `open` 参数与 `data-exhibit` 的取值 */
	id: string;
	name: string;
	/** 陈列的组件单元；`@violet/ui` 单元名与清单一致，铭牌上显示为 slug */
	units: string[];
	zone: Zone;
	category: Category;
	/** 含展开态的占地；展柜按它留出舞台，不得裁切 */
	footprint: Footprint;
	/** 第一项为展柜里的陈列态；省略时只有默认态 */
	states?: ExhibitState[];
	/** 真实组件；省略表示单元尚未建成，展柜只留占位 */
	Render?: ComponentType<ExhibitRenderProps>;
	/** 待建展品对应的工单号 */
	issue?: number;
}

/** 展品状态：新架构单元、旧单元、站点组件或待建。 */
export type ExhibitStatus = "foundation" | "legacy" | "site" | "planned";

export const ZONES: { id: Zone; name: string; rule: string }[] = [
	{ id: "banner", name: "整幅橱窗", rule: "按真实宽度陈列，独占一行" },
	{ id: "stage", name: "浮层舞台", rule: "带触发器，展开态算在占地里" },
	{ id: "shelf", name: "微件架", rule: "一个展柜放一整族" },
	{ id: "field", name: "字段", rule: "带标签、提示与展开态" },
	{ id: "content", name: "内容", rule: "放在正文语境里" },
];

export const CATEGORIES: { id: Category; name: string }[] = [
	{ id: "action", name: "操作" },
	{ id: "form", name: "表单" },
	{ id: "navigation", name: "导航" },
	{ id: "overlay", name: "浮层" },
	{ id: "feedback", name: "反馈" },
	{ id: "display", name: "展示" },
	{ id: "content", name: "内容" },
	{ id: "layout", name: "布局" },
];

export const STATUS_LABEL: Record<ExhibitStatus, string> = {
	foundation: "新架构",
	legacy: "旧单元",
	site: "站点组件",
	planned: "待建",
};

const unitStatus = new Map(manifest.components.map((unit) => [unit.name, unit.status]));

/** 由清单推导展品状态：未建成为待建，全部单元为 foundation 才算新架构，清单外的单元属于站点。 */
export function exhibitStatus(exhibit: Exhibit): ExhibitStatus {
	if (!exhibit.Render) return "planned";
	const statuses = exhibit.units.map((unit) => unitStatus.get(unit));
	if (statuses.every((status) => status === undefined)) return "site";
	return statuses.every((status) => status === "foundation") ? "foundation" : "legacy";
}

/** 展柜内边距，舞台四周各留这么多。 */
export const CASE_PADDING = 32;

/** 展厅栅格的最小列宽：非整幅展品的最大占地加两侧柜内边距。 */
export function caseColumnWidth(exhibits: Exhibit[]): number {
	const widths = exhibits
		.filter((exhibit) => exhibit.zone !== "banner")
		.map((exhibit) => exhibit.footprint.width);
	return Math.max(0, ...widths) + CASE_PADDING * 2;
}
