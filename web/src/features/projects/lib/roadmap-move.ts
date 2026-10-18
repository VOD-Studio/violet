import type { BoardMove } from "@violetjs/kanban/core";
import type { RoadmapDetail, RoadmapItem, RoadmapStage } from "../model/roadmap";
import type { RoadmapProgress } from "../model/roadmap-summary";
import { ROADMAP_STAGES } from "./roadmap-board";

/** 移动接口的请求体：目标阶段与目标位置两侧的条目，位于阶段首位或末尾时那一侧为空串。 */
export interface RoadmapMoveInput {
	stage: RoadmapStage;
	/** 目标位置的前一条 */
	before_id: string;
	/** 目标位置的后一条 */
	after_id: string;
}

/** 看板报告的一次移动换成移动接口的请求体；看板的列就是阶段。 */
export function toMoveInput(move: BoardMove): RoadmapMoveInput {
	return {
		stage: move.to.columnId as RoadmapStage,
		before_id: move.previousId ?? "",
		after_id: move.nextId ?? "",
	};
}

const stageRank = (stage: RoadmapStage) => ROADMAP_STAGES.indexOf(stage);

/** 与后端一致的展示顺序：计划中、进行中按位置（字节序），已完成按完成日期倒序、同日按编号倒序。 */
function compareItems(a: RoadmapItem, b: RoadmapItem): number {
	if (a.stage !== b.stage) return stageRank(a.stage) - stageRank(b.stage);
	if (a.stage === "completed") {
		const byDate = (b.completion_date ?? "").localeCompare(a.completion_date ?? "");
		return byDate !== 0 ? byDate : b.number - a.number;
	}
	if (a.position !== b.position) return a.position < b.position ? -1 : 1;
	return a.number - b.number;
}

function progressOf(items: readonly RoadmapItem[]): RoadmapProgress {
	const count = (stage: RoadmapStage) => items.filter((item) => item.stage === stage).length;
	const total = items.length;
	const completed = count("completed");
	return {
		planned: count("planned"),
		in_progress: count("in_progress"),
		completed,
		total,
		percent: total === 0 ? 0 : Math.round((completed * 100) / total),
	};
}

/**
 * 把移动接口返回的条目写回路线图：阶段、位置、完成日期与交付版本以接口为准，
 * 条目按后端的展示顺序重新排列，进度概览随之重算。其他条目的被阻塞标记要等下一次拉取。
 */
export function applyMovedItem(detail: RoadmapDetail, moved: RoadmapItem): RoadmapDetail {
	if (!detail.items.some((item) => item.id === moved.id)) return detail;
	const items = detail.items
		.map((item) => (item.id === moved.id ? moved : item))
		.sort(compareItems);
	return { ...detail, items, progress: progressOf(items) };
}
