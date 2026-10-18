import type { RoadmapChecklistItem, RoadmapItem, RoadmapLink } from "../model/roadmap";

/** 编辑接口的请求体：整体替换条目内容，阶段与顺序只能靠移动改变。 */
export interface RoadmapContentInput {
	title: string;
	description: string;
	tags: string[];
	links: RoadmapLink[];
	checklist: RoadmapChecklistItem[];
	/** YYYY-MM-DD，只用于已完成条目；省略时后端保留原来的完成日期 */
	completion_date?: string;
	/** 只有已完成条目可以非空 */
	delivered_version: string;
}

/** 条目当前的内容，作为编辑的起点，也是撤销时要恢复成的样子。 */
export function contentOf(item: RoadmapItem): RoadmapContentInput {
	return {
		title: item.title,
		description: item.description,
		tags: [...item.tags],
		links: item.links.map((link) => ({ ...link })),
		checklist: item.checklist.map((entry) => ({ ...entry })),
		...(item.completion_date ? { completion_date: item.completion_date } : {}),
		delivered_version: item.delivered_version,
	};
}
