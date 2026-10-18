import type { BoardMove } from "@violetjs/kanban/core";
import { describe, expect, it } from "vitest";
import type { RoadmapDetail, RoadmapItem, RoadmapStage } from "../model/roadmap";
import { applyMovedItem, keepCompletion, toMoveInput } from "./roadmap-move";

const item = (
	number: number,
	stage: RoadmapStage,
	overrides: Partial<RoadmapItem> = {},
): RoadmapItem => ({
	id: `i${number}`,
	project_id: "p",
	number,
	title: `条目 ${number}`,
	description: "",
	stage,
	position: `a${number}`,
	tags: [],
	links: [],
	checklist: [],
	completion_date: stage === "completed" ? "2026-10-01" : null,
	delivered_version: "",
	blocked: false,
	created_at: "2026-10-01T00:00:00Z",
	updated_at: "2026-10-01T00:00:00Z",
	...overrides,
});

const detail = (items: RoadmapItem[]): RoadmapDetail => ({
	project: { id: "p", title: "P", slug: "p" } as RoadmapDetail["project"],
	items,
	relations: [],
	progress: { planned: 0, in_progress: 0, completed: 0, total: 0, percent: 0 },
});

const move = (overrides: Partial<BoardMove>): BoardMove => ({
	cardId: "i1",
	from: { columnId: "planned", index: 0 },
	to: { columnId: "in_progress", index: 0 },
	previousId: null,
	nextId: null,
	fromPreviousId: null,
	fromNextId: null,
	...overrides,
});

describe("toMoveInput", () => {
	it("目标列就是阶段，两侧条目对应接口的 before_id 与 after_id，没有时为空串", () => {
		expect(toMoveInput(move({ previousId: "i2", nextId: "i3" }))).toEqual({
			stage: "in_progress",
			before_id: "i2",
			after_id: "i3",
		});
		expect(toMoveInput(move({ to: { columnId: "completed", index: 0 } }))).toEqual({
			stage: "completed",
			before_id: "",
			after_id: "",
		});
	});
});

describe("applyMovedItem", () => {
	it("同阶段内按新位置重排，位置相同时按编号", () => {
		const before = detail([item(1, "planned"), item(2, "planned"), item(3, "planned")]);

		const after = applyMovedItem(before, item(1, "planned", { position: "a25" }));

		expect(after.items.map((entry) => entry.number)).toEqual([2, 1, 3]);
	});

	it("进入已完成：完成日期与交付版本以接口为准，按完成日期倒序排在最前；进度重算", () => {
		const before = detail([
			item(1, "planned"),
			item(2, "in_progress"),
			item(3, "completed", { completion_date: "2026-10-05" }),
		]);

		const after = applyMovedItem(
			before,
			item(1, "completed", { completion_date: "2026-10-19", delivered_version: "v1.2.0" }),
		);

		expect(after.items.map((entry) => [entry.number, entry.stage])).toEqual([
			[2, "in_progress"],
			[1, "completed"],
			[3, "completed"],
		]);
		expect(after.items[1]).toMatchObject({
			completion_date: "2026-10-19",
			delivered_version: "v1.2.0",
		});
		expect(after.progress).toEqual({
			planned: 0,
			in_progress: 1,
			completed: 2,
			total: 3,
			percent: 67,
		});
	});

	it("离开已完成：清空的完成日期与交付版本照接口写回，按位置回到所在阶段", () => {
		const before = detail([
			item(2, "planned", { position: "b" }),
			item(1, "completed", { delivered_version: "v1" }),
		]);

		const after = applyMovedItem(before, item(1, "planned", { position: "a" }));

		expect(after.items.map((entry) => entry.number)).toEqual([1, 2]);
		expect(after.items[0]).toMatchObject({ completion_date: null, delivered_version: "" });
	});

	it("同日完成的条目按编号倒序", () => {
		const before = detail([
			item(5, "completed", { completion_date: "2026-10-10" }),
			item(1, "planned"),
		]);

		const after = applyMovedItem(
			before,
			item(1, "completed", { completion_date: "2026-10-10" }),
		);

		expect(after.items.map((entry) => entry.number)).toEqual([5, 1]);
	});

	it("缓存里没有这个条目（例如已被删除）时原样返回", () => {
		const before = detail([item(1, "planned")]);

		expect(applyMovedItem(before, item(9, "completed"))).toBe(before);
	});
});

describe("keepCompletion", () => {
	const input = { stage: "completed" as const, before_id: "", after_id: "i2" };

	it("回到已完成时带上原来的完成日期与交付版本", () => {
		expect(
			keepCompletion(
				input,
				item(1, "completed", {
					completion_date: "2026-09-01",
					delivered_version: "v1.0.0",
				}),
			),
		).toEqual({ ...input, completion_date: "2026-09-01", delivered_version: "v1.0.0" });
	});

	it("目标不是已完成，或原来不在已完成时原样返回", () => {
		const planned = { ...input, stage: "planned" as const };
		expect(keepCompletion(planned, item(1, "completed"))).toBe(planned);
		expect(keepCompletion(input, item(1, "planned"))).toBe(input);
	});
});
