import { describe, expect, it } from "vitest";
import type { RoadmapItem, RoadmapStage } from "../model/roadmap";
import {
	buildRoadmapBoard,
	COMPLETED_PREVIEW_LIMIT,
	shownItemIds,
	toBoardRelations,
} from "./roadmap-board";

const item = (id: string, stage: RoadmapStage): RoadmapItem => ({
	id,
	project_id: "p",
	number: Number(id.replace(/\D/g, "")) || 1,
	title: id,
	description: "",
	stage,
	position: id,
	tags: [],
	links: [],
	completion_date: stage === "completed" ? "2026-10-01" : null,
	delivered_version: "",
	blocked: false,
	created_at: "2026-10-01T00:00:00Z",
	updated_at: "2026-10-01T00:00:00Z",
});
const completed = (count: number) =>
	Array.from({ length: count }, (_, index) => item(`c${index + 1}`, "completed"));

describe("buildRoadmapBoard", () => {
	it("按三个阶段分列，列的顺序固定，每列内沿用后端给出的顺序", () => {
		const board = buildRoadmapBoard(
			[
				item("p2", "planned"),
				item("i1", "in_progress"),
				item("p1", "planned"),
				item("c1", "completed"),
			],
			{ expandCompleted: false },
		);

		expect(board.columns.map((column) => [column.id, column.title])).toEqual([
			["planned", "计划中"],
			["in_progress", "进行中"],
			["completed", "已完成"],
		]);
		expect(board.order).toEqual({
			planned: ["p2", "p1"],
			in_progress: ["i1"],
			completed: ["c1"],
		});
	});

	it("已完成阶段是自动排序列并带着总数，其余阶段没有", () => {
		const board = buildRoadmapBoard(completed(3), { expandCompleted: false });

		const [planned, , done] = board.columns;
		expect(done).toMatchObject({ id: "completed", autoSort: "start", total: 3 });
		expect(planned.autoSort).toBeUndefined();
		expect(planned.total).toBeUndefined();
	});

	it("已完成不超过上限时全部显示，没有收起的条目", () => {
		const board = buildRoadmapBoard(completed(COMPLETED_PREVIEW_LIMIT), {
			expandCompleted: false,
		});

		expect(board.order.completed).toHaveLength(COMPLETED_PREVIEW_LIMIT);
		expect(board.hiddenCompleted).toBe(0);
	});

	it("已完成超过上限时默认只取最前面的 10 条，总数与收起的条数照实给出", () => {
		const board = buildRoadmapBoard(completed(23), { expandCompleted: false });

		expect(board.order.completed).toHaveLength(COMPLETED_PREVIEW_LIMIT);
		expect(board.order.completed[0]).toBe("c1");
		expect(board.order.completed[9]).toBe("c10");
		expect(board.completedTotal).toBe(23);
		expect(board.hiddenCompleted).toBe(13);
		expect(board.firstHiddenCompletedId).toBe("c11");
		expect(board.columns[2].total).toBe(23);
	});

	it("展开后显示已完成的全部条目，不再有收起的条目", () => {
		const board = buildRoadmapBoard(completed(23), { expandCompleted: true });

		expect(board.order.completed).toHaveLength(23);
		expect(board.hiddenCompleted).toBe(0);
		expect(board.firstHiddenCompletedId).toBeNull();
		expect(board.columns[2].total).toBe(23);
	});

	it("limit 可配置", () => {
		const board = buildRoadmapBoard(completed(8), { expandCompleted: false, limit: 5 });

		expect(board.order.completed).toEqual(["c1", "c2", "c3", "c4", "c5"]);
		expect(board.hiddenCompleted).toBe(3);
	});

	it("阶段不认识的条目不显示，没有条目时三列都是空的", () => {
		const odd = { ...item("x1", "planned"), stage: "archived" } as unknown as RoadmapItem;

		expect(buildRoadmapBoard([odd], { expandCompleted: false }).order).toEqual({
			planned: [],
			in_progress: [],
			completed: [],
		});
		expect(buildRoadmapBoard([], { expandCompleted: false }).completedTotal).toBe(0);
	});
});

describe("toBoardRelations 与 shownItemIds", () => {
	it("关系的来源、目标与类型原样对应到看板的字段", () => {
		expect(
			toBoardRelations([
				{
					id: "r1",
					project_id: "p",
					source_id: "a",
					target_id: "b",
					type: "blocks",
					created_at: "2026-10-01T00:00:00Z",
				},
			]),
		).toEqual([{ sourceId: "a", targetId: "b", type: "blocks" }]);
		expect(toBoardRelations([])).toEqual([]);
	});

	it("显示的条目不含已完成阶段收起的那些", () => {
		const board = buildRoadmapBoard([...completed(12), item("p1", "planned")], {
			expandCompleted: false,
		});

		const shown = shownItemIds(board);

		expect(shown.has("p1")).toBe(true);
		expect(shown.has("c10")).toBe(true);
		expect(shown.has("c11")).toBe(false);
		expect(shown.size).toBe(11);
	});
});
