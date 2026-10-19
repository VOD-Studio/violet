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

/** 编辑表单的草稿：标签是一段用逗号分隔的文字，日期与版本只对已完成条目有意义。 */
export interface RoadmapDraft {
	title: string;
	description: string;
	/** 用逗号（全角或半角）、顿号或换行分隔 */
	tags: string;
	links: RoadmapLink[];
	checklist: RoadmapChecklistItem[];
	deliveredVersion: string;
	/** YYYY-MM-DD；空串表示不改 */
	completionDate: string;
}

export function draftOf(item: RoadmapItem): RoadmapDraft {
	return {
		title: item.title,
		description: item.description,
		tags: item.tags.join("，"),
		links: item.links.map((link) => ({ ...link })),
		checklist: item.checklist.map((entry) => ({ ...entry })),
		deliveredVersion: item.delivered_version,
		completionDate: item.completion_date ?? "",
	};
}

/**
 * 把草稿整理成编辑接口的请求体：去掉首尾空白，丢掉没填地址的链接与没写字的子项，
 * 标签拆开并去重；只有已完成条目带交付版本与完成日期。
 */
export function contentFromDraft(draft: RoadmapDraft, item: RoadmapItem): RoadmapContentInput {
	const tags = [
		...new Set(
			draft.tags
				.split(/[,，、\n]/)
				.map((tag) => tag.trim())
				.filter(Boolean),
		),
	];
	const completed = item.stage === "completed";
	return {
		title: draft.title.trim(),
		description: draft.description.trim(),
		tags,
		links: draft.links
			.map((link) => ({ label: link.label.trim(), url: link.url.trim() }))
			.filter((link) => link.url),
		checklist: draft.checklist
			.map((entry) => ({ text: entry.text.trim(), done: entry.done }))
			.filter((entry) => entry.text),
		...(completed && draft.completionDate ? { completion_date: draft.completionDate } : {}),
		delivered_version: completed ? draft.deliveredVersion.trim() : "",
	};
}
