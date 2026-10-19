import { describe, expect, it } from "vitest";
import { entryIndex } from "./moves.ts";
import { stepTarget } from "./steps.ts";

const state = {
	columns: ["todo", "doing", "done"],
	order: { todo: ["a", "b", "c"], doing: ["d"], done: ["x", "y"] },
};
const autoDone = (columnId: string) => (columnId === "done" ? ("start" as const) : undefined);
const none = () => undefined;

describe("entryIndex", () => {
	it("入口在开头为 0，在末尾为列内卡片数", () => {
		expect(entryIndex("start", 4)).toBe(0);
		expect(entryIndex("end", 4)).toBe(4);
	});
});

describe("stepTarget：列内上下", () => {
	const origin = { columnId: "todo", index: 1 };

	it("向上或向下移动一格，序号按去掉被拖卡片后的列表计算", () => {
		expect(stepTarget(state, "b", origin, origin, "up", none)).toEqual({
			kind: "moved",
			target: { columnId: "todo", index: 0 },
		});
		expect(stepTarget(state, "b", origin, origin, "down", none)).toEqual({
			kind: "moved",
			target: { columnId: "todo", index: 2 },
		});
	});

	it("到达列首或列尾时是边缘", () => {
		expect(
			stepTarget(
				state,
				"a",
				{ columnId: "todo", index: 0 },
				{ columnId: "todo", index: 0 },
				"up",
				none,
			),
		).toEqual({ kind: "edge" });
		expect(
			stepTarget(
				state,
				"c",
				{ columnId: "todo", index: 2 },
				{ columnId: "todo", index: 2 },
				"down",
				none,
			),
		).toEqual({ kind: "edge" });
	});

	it("跨列后在目标列内上下：可落的序号是 0 到该列卡片数", () => {
		const current = { columnId: "doing", index: 0 };

		expect(
			stepTarget(state, "a", { columnId: "todo", index: 0 }, current, "down", none),
		).toEqual({
			kind: "moved",
			target: { columnId: "doing", index: 1 },
		});
		expect(
			stepTarget(
				state,
				"a",
				{ columnId: "todo", index: 0 },
				{ columnId: "doing", index: 1 },
				"down",
				none,
			),
		).toEqual({ kind: "edge" });
	});

	it("自动排序列内上下一律是被拒绝，包括刚进入之后", () => {
		const origin = { columnId: "todo", index: 0 };

		expect(
			stepTarget(state, "a", origin, { columnId: "done", index: 0 }, "down", autoDone),
		).toEqual({ kind: "autoSorted" });
		expect(
			stepTarget(
				state,
				"x",
				{ columnId: "done", index: 0 },
				{ columnId: "done", index: 0 },
				"up",
				autoDone,
			),
		).toEqual({ kind: "autoSorted" });
	});
});

describe("stepTarget：左右换列", () => {
	it("换到相邻列并保持纵向序号，不超过目标列的长度", () => {
		const origin = { columnId: "todo", index: 2 };

		expect(stepTarget(state, "c", origin, origin, "right", none)).toEqual({
			kind: "moved",
			target: { columnId: "doing", index: 1 },
		});
		expect(
			stepTarget(state, "c", origin, { columnId: "doing", index: 1 }, "left", none),
		).toEqual({
			kind: "moved",
			target: { columnId: "todo", index: 1 },
		});
	});

	it("没有相邻列时是边缘", () => {
		const origin = { columnId: "todo", index: 0 };

		expect(stepTarget(state, "a", origin, origin, "left", none)).toEqual({ kind: "edge" });
		expect(
			stepTarget(
				state,
				"x",
				{ columnId: "done", index: 0 },
				{ columnId: "done", index: 0 },
				"right",
				autoDone,
			),
		).toEqual({ kind: "edge" });
	});

	it("进入自动排序列：落在入口一端，与纵向序号无关", () => {
		const origin = { columnId: "doing", index: 0 };

		expect(stepTarget(state, "d", origin, origin, "right", autoDone)).toEqual({
			kind: "moved",
			target: { columnId: "done", index: 0 },
		});
		expect(stepTarget(state, "d", origin, origin, "right", () => "end" as const)).toEqual({
			kind: "moved",
			target: { columnId: "done", index: 2 },
		});
	});

	it("回到出发的自动排序列：回到出发的位置，而不是入口一端", () => {
		const origin = { columnId: "done", index: 1 };

		expect(
			stepTarget(state, "y", origin, { columnId: "doing", index: 0 }, "right", autoDone),
		).toEqual({
			kind: "moved",
			target: { columnId: "done", index: 1 },
		});
	});
});
