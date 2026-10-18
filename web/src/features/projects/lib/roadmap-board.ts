import type { RoadmapItem, RoadmapStage } from "../model/roadmap";

/** 看板从左到右的阶段顺序。 */
export const ROADMAP_STAGES: readonly RoadmapStage[] = ["planned", "in_progress", "completed"];

/** 阶段的展示名称。 */
export const ROADMAP_STAGE_LABELS: Record<RoadmapStage, string> = {
	planned: "计划中",
	in_progress: "进行中",
	completed: "已完成",
};

/** 已完成阶段默认只显示最近这么多条，其余点「展开更多」。 */
export const COMPLETED_PREVIEW_LIMIT = 10;

/** 一个阶段对应看板的一列。 */
export interface RoadmapColumn {
	id: RoadmapStage;
	title: string;
	/** 已完成阶段内不手动重排，进入的卡片出现在最前（最近完成）。 */
	autoSort?: "start";
	/** 阶段的条目总数，只显示一部分时用它让列头数量不失真。 */
	total?: number;
}

/** 看板的数据：列与每列内的条目 id。 */
export interface RoadmapBoardModel {
	columns: RoadmapColumn[];
	order: Record<RoadmapStage, string[]>;
	/** 已完成阶段当前收起而未显示的条目数。 */
	hiddenCompleted: number;
	/** 已完成阶段收起的条目里最靠前的一条，展开后它是第一条新露出的卡片。 */
	firstHiddenCompletedId: string | null;
	/** 已完成阶段的条目总数。 */
	completedTotal: number;
}

/**
 * 把条目按阶段分成看板的列与顺序。
 *
 * 顺序沿用后端给出的顺序，不再排序；已完成阶段在未展开时只取最前面的 `limit` 条。
 * 阶段不认识的条目不显示。
 *
 * @param items - 后端按展示顺序给出的全部条目
 * @param options.expandCompleted - 展开已完成阶段的全部条目
 * @param options.limit - 未展开时已完成阶段显示的条数
 */
export function buildRoadmapBoard(
	items: readonly RoadmapItem[],
	options: { expandCompleted: boolean; limit?: number },
): RoadmapBoardModel {
	const limit = options.limit ?? COMPLETED_PREVIEW_LIMIT;
	const byStage: Record<RoadmapStage, string[]> = { planned: [], in_progress: [], completed: [] };
	for (const item of items) byStage[item.stage]?.push(item.id);
	const completedTotal = byStage.completed.length;
	const collapse = !options.expandCompleted && completedTotal > limit;
	const order = {
		...byStage,
		completed: collapse ? byStage.completed.slice(0, limit) : byStage.completed,
	};
	return {
		columns: ROADMAP_STAGES.map((stage) => ({
			id: stage,
			title: ROADMAP_STAGE_LABELS[stage],
			...(stage === "completed" ? { autoSort: "start" as const, total: completedTotal } : {}),
		})),
		order,
		hiddenCompleted: collapse ? completedTotal - limit : 0,
		firstHiddenCompletedId: collapse ? byStage.completed[limit] : null,
		completedTotal,
	};
}
