import { describe, expect, it } from "vitest";
import {
	applyMove,
	type ColumnLayout,
	createMove,
	invertMove,
	isNoopMove,
	locateCard,
	resolveDropTarget,
	violatesAutoSort,
} from "./moves.ts";
import type { BoardState } from "./state.ts";

const state = {
	columns: ["todo", "doing", "done"],
	order: { todo: ["a", "b", "c"], doing: ["d"], done: [] },
};

describe("locateCard", () => {
	it("给出卡片所在列与列内序号，不存在时为 null", () => {
		expect(locateCard(state, "c")).toEqual({ columnId: "todo", index: 2 });
		expect(locateCard(state, "d")).toEqual({ columnId: "doing", index: 0 });
		expect(locateCard(state, "missing")).toBeNull();
	});
});

describe("createMove", () => {
	it("目标序号是去掉被拖卡片后的列内序号，并带前后相邻卡片 id", () => {
		// 列表去掉 a 后是 [b, c]，放到序号 1 即 b 与 c 之间
		expect(createMove(state, "a", { columnId: "todo", index: 1 })).toEqual({
			cardId: "a",
			from: { columnId: "todo", index: 0 },
			to: { columnId: "todo", index: 1 },
			previousId: "b",
			nextId: "c",
			fromPreviousId: null,
			fromNextId: "b",
		});
	});

	it("放到列首或列尾时对应一侧没有相邻卡片", () => {
		expect(createMove(state, "c", { columnId: "todo", index: 0 })).toMatchObject({
			previousId: null,
			nextId: "a",
		});
		expect(createMove(state, "a", { columnId: "todo", index: 2 })).toMatchObject({
			previousId: "c",
			nextId: null,
		});
	});

	it("跨列移动：相邻卡片取自目标列", () => {
		expect(createMove(state, "b", { columnId: "doing", index: 0 })).toEqual({
			cardId: "b",
			from: { columnId: "todo", index: 1 },
			to: { columnId: "doing", index: 0 },
			previousId: null,
			nextId: "d",
			fromPreviousId: "a",
			fromNextId: "c",
		});
		expect(createMove(state, "b", { columnId: "done", index: 0 })).toMatchObject({
			previousId: null,
			nextId: null,
		});
	});

	it("超出范围的序号收敛到列首或列尾", () => {
		expect(createMove(state, "a", { columnId: "doing", index: 99 })?.to.index).toBe(1);
		expect(createMove(state, "a", { columnId: "doing", index: -3 })?.to.index).toBe(0);
	});

	it("卡片或目标列不存在时不产生移动", () => {
		expect(createMove(state, "missing", { columnId: "todo", index: 0 })).toBeNull();
		expect(createMove(state, "a", { columnId: "ghost", index: 0 })).toBeNull();
	});
});

describe("createMove：出发处的相邻卡片", () => {
	it("记录卡片出发时上下的卡片，位于列首或列尾时对应一侧为 null", () => {
		expect(createMove(state, "c", { columnId: "doing", index: 0 })).toMatchObject({
			fromPreviousId: "b",
			fromNextId: null,
		});
		expect(createMove(state, "d", { columnId: "todo", index: 0 })).toMatchObject({
			fromPreviousId: null,
			fromNextId: null,
		});
	});

	it("同列移动时取自移动之前的排列", () => {
		expect(createMove(state, "a", { columnId: "todo", index: 2 })).toMatchObject({
			previousId: "c",
			nextId: null,
			fromPreviousId: null,
			fromNextId: "b",
		});
	});
});

describe("isNoopMove", () => {
	it("放回原来的位置不算移动", () => {
		const back = createMove(state, "b", { columnId: "todo", index: 1 });
		const away = createMove(state, "b", { columnId: "todo", index: 0 });

		expect(back && isNoopMove(back)).toBe(true);
		expect(away && isNoopMove(away)).toBe(false);
	});

	it("换列即使序号相同也是移动", () => {
		const move = createMove(state, "a", { columnId: "doing", index: 0 });

		expect(move && isNoopMove(move)).toBe(false);
	});
});

describe("applyMove", () => {
	it("列内移动", () => {
		const move = createMove(state, "a", { columnId: "todo", index: 2 });

		expect(move && applyMove(state, move).order).toEqual({
			todo: ["b", "c", "a"],
			doing: ["d"],
			done: [],
		});
	});

	it("跨列移动，且不修改传入状态", () => {
		const move = createMove(state, "b", { columnId: "doing", index: 0 });

		expect(move && applyMove(state, move).order).toEqual({
			todo: ["a", "c"],
			doing: ["b", "d"],
			done: [],
		});
		expect(state.order.todo).toEqual(["a", "b", "c"]);
	});
});

describe("resolveDropTarget", () => {
	// 三列，每列宽 100、间距 20，高 0..300；每张卡片高 50、间距 10
	const card = (id: string, row: number, left: number) => ({
		id,
		rect: { left, top: 40 + row * 60, right: left + 100, bottom: 90 + row * 60 },
	});
	const columns: ColumnLayout[] = [
		{
			id: "todo",
			rect: { left: 0, top: 0, right: 100, bottom: 300 },
			cards: [card("a", 0, 0), card("b", 1, 0)],
		},
		{
			id: "doing",
			rect: { left: 120, top: 0, right: 220, bottom: 300 },
			cards: [card("c", 0, 120)],
		},
		{ id: "done", rect: { left: 240, top: 0, right: 340, bottom: 300 }, cards: [] },
	];

	it("横向命中列，纵向按卡片中线算序号", () => {
		// a 的中线 65，b 的中线 125
		expect(resolveDropTarget(columns, { x: 50, y: 50 })).toEqual({
			columnId: "todo",
			index: 0,
		});
		expect(resolveDropTarget(columns, { x: 50, y: 100 })).toEqual({
			columnId: "todo",
			index: 1,
		});
		expect(resolveDropTarget(columns, { x: 50, y: 200 })).toEqual({
			columnId: "todo",
			index: 2,
		});
		expect(resolveDropTarget(columns, { x: 150, y: 200 })).toEqual({
			columnId: "doing",
			index: 1,
		});
	});

	it("禁用的列（例如折叠的列）不是落点：指针落在它上面时没有落点，邻列的划分不变", () => {
		const withDisabled = columns.map((column) =>
			column.id === "doing" ? { ...column, disabled: true } : column,
		);

		expect(resolveDropTarget(withDisabled, { x: 150, y: 100 })).toBeNull();
		expect(resolveDropTarget(withDisabled, { x: 50, y: 100 })?.columnId).toBe("todo");
		expect(resolveDropTarget(withDisabled, { x: 290, y: 100 })?.columnId).toBe("done");
		// 空隙仍按中线划给两侧的列
		expect(resolveDropTarget(withDisabled, { x: 108, y: 50 })?.columnId).toBe("todo");
		expect(resolveDropTarget(withDisabled, { x: 232, y: 50 })?.columnId).toBe("done");
	});

	it("列间空隙归属最近的列", () => {
		expect(resolveDropTarget(columns, { x: 108, y: 50 })?.columnId).toBe("todo");
		expect(resolveDropTarget(columns, { x: 112, y: 50 })?.columnId).toBe("doing");
	});

	it("空列的序号是 0", () => {
		expect(resolveDropTarget(columns, { x: 300, y: 150 })).toEqual({
			columnId: "done",
			index: 0,
		});
	});

	it("指针略微越过看板边缘仍归属最近的列，远离看板才没有落点", () => {
		// 容差默认 48px：列区域 x 0..340、y 0..300
		expect(resolveDropTarget(columns, { x: -30, y: 50 })?.columnId).toBe("todo");
		expect(resolveDropTarget(columns, { x: 380, y: 50 })?.columnId).toBe("done");
		expect(resolveDropTarget(columns, { x: 50, y: 340 })).toEqual({
			columnId: "todo",
			index: 2,
		});
		expect(resolveDropTarget(columns, { x: 50, y: -30 })).toEqual({
			columnId: "todo",
			index: 0,
		});

		expect(resolveDropTarget(columns, { x: -100, y: 50 })).toBeNull();
		expect(resolveDropTarget(columns, { x: 450, y: 50 })).toBeNull();
		expect(resolveDropTarget(columns, { x: 50, y: -100 })).toBeNull();
		expect(resolveDropTarget(columns, { x: 50, y: 400 })).toBeNull();
	});

	it("容差可调", () => {
		expect(resolveDropTarget(columns, { x: -30, y: 50 }, { slack: 0 })).toBeNull();
		expect(resolveDropTarget(columns, { x: -90, y: 50 }, { slack: 100 })?.columnId).toBe(
			"todo",
		);
	});

	it("自动排序列：从别的列进入时落点由列的入口决定，与指针高度无关", () => {
		const auto: ColumnLayout[] = [
			columns[0],
			{ ...columns[1], autoSort: "start" },
			{ ...columns[2], autoSort: "end" },
		];

		expect(resolveDropTarget(auto, { x: 150, y: 200 }, { originColumnId: "todo" })).toEqual({
			columnId: "doing",
			index: 0,
		});
		expect(resolveDropTarget(auto, { x: 300, y: 10 }, { originColumnId: "todo" })).toEqual({
			columnId: "done",
			index: 0,
		});
	});

	it("自动排序列：在本列内拖动仍按指针位置算序号，使用方据此判断是否手动重排", () => {
		const auto: ColumnLayout[] = [{ ...columns[1], autoSort: "start" }];

		expect(resolveDropTarget(auto, { x: 150, y: 200 }, { originColumnId: "doing" })).toEqual({
			columnId: "doing",
			index: 1,
		});
	});
});

describe("violatesAutoSort", () => {
	const isAuto = (columnId: string) => columnId === "done";

	it("自动排序列内的手动重排被拒绝", () => {
		const move = createMove({ columns: ["done"], order: { done: ["x", "y", "z"] } }, "z", {
			columnId: "done",
			index: 0,
		});

		expect(move && violatesAutoSort(move, isAuto)).toBe(true);
	});

	it("进入或离开自动排序列、以及普通列内重排都不受限", () => {
		const enter = createMove(state, "a", { columnId: "done", index: 0 });
		const leave = createMove(
			{ columns: ["todo", "done"], order: { todo: [], done: ["x"] } },
			"x",
			{ columnId: "todo", index: 0 },
		);
		const reorder = createMove(state, "a", { columnId: "todo", index: 2 });

		expect(enter && violatesAutoSort(enter, isAuto)).toBe(false);
		expect(leave && violatesAutoSort(leave, isAuto)).toBe(false);
		expect(reorder && violatesAutoSort(reorder, isAuto)).toBe(false);
	});

	it("在自动排序列内放回原位不算重排，也不被拒绝", () => {
		const back = createMove({ columns: ["done"], order: { done: ["x", "y"] } }, "x", {
			columnId: "done",
			index: 0,
		});

		expect(back && violatesAutoSort(back, isAuto)).toBe(false);
	});
});

describe("invertMove", () => {
	const make = (
		cardId: string,
		target: { columnId: string; index: number },
		from: BoardState = state,
	) => createMove(from, cardId, target) as NonNullable<ReturnType<typeof createMove>>;

	it("反向移动从目标回到出发位置，相邻卡片取自出发处，不需要看板状态", () => {
		const inverse = invertMove(make("a", { columnId: "doing", index: 1 }));

		expect(inverse).toEqual({
			cardId: "a",
			from: { columnId: "doing", index: 1 },
			to: { columnId: "todo", index: 0 },
			previousId: null,
			nextId: "b",
			fromPreviousId: "d",
			fromNextId: null,
		});
	});

	it("先移动再反向移动，回到原来的状态", () => {
		for (const target of [
			{ columnId: "todo", index: 2 },
			{ columnId: "doing", index: 0 },
			{ columnId: "done", index: 0 },
		]) {
			const move = make("b", target);

			expect(applyMove(applyMove(state, move), invertMove(move)).order).toEqual(state.order);
		}
	});

	it("反向两次得到原来的移动", () => {
		const move = make("c", { columnId: "doing", index: 0 });

		expect(invertMove(invertMove(move))).toEqual(move);
	});

	it("相邻卡片取自移动发生时的状态：中间还有别的移动也不会指错卡片", () => {
		// 先把 a 移到「开发中」，再基于这个新状态把 c 移到「开发中」末尾
		const afterFirst = applyMove(state, make("a", { columnId: "doing", index: 1 }));
		const second = make("c", { columnId: "doing", index: 2 }, afterFirst);
		const afterSecond = applyMove(afterFirst, second);

		const restored = applyMove(afterSecond, invertMove(second));

		expect(restored.order).toEqual(afterFirst.order);
		expect(invertMove(second)).toMatchObject({ previousId: "b", nextId: null });
	});
});
