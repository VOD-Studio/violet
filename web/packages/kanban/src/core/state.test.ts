import { describe, expect, it } from "vitest";
import { normalizeBoardState, resolveBoard } from "./state.ts";

describe("normalizeBoardState", () => {
	it("为没有排序记录的列补空数组，并丢弃不属于任何列的排序记录", () => {
		const result = normalizeBoardState({
			columns: ["todo", "doing"],
			order: { todo: ["a"], ghost: ["x"] },
		});

		expect(result).toEqual({ columns: ["todo", "doing"], order: { todo: ["a"], doing: [] } });
	});

	it("列 id 重复时只保留第一次出现", () => {
		const result = normalizeBoardState({
			columns: ["todo", "doing", "todo"],
			order: { todo: ["a"], doing: ["b"] },
		});

		expect(result.columns).toEqual(["todo", "doing"]);
	});

	it("同一列内重复的卡片 id 只保留第一次出现", () => {
		const result = normalizeBoardState({
			columns: ["todo"],
			order: { todo: ["a", "b", "a"] },
		});

		expect(result.order.todo).toEqual(["a", "b"]);
	});

	it("卡片 id 出现在多列时归属列顺序中最靠前的列", () => {
		const result = normalizeBoardState({
			columns: ["todo", "doing"],
			order: { todo: ["a"], doing: ["b", "a"] },
		});

		expect(result.order).toEqual({ todo: ["a"], doing: ["b"] });
	});

	it("不修改传入的状态", () => {
		const state = {
			columns: ["todo", "todo"],
			order: { todo: ["a", "a"] },
		};

		normalizeBoardState(state);

		expect(state).toEqual({ columns: ["todo", "todo"], order: { todo: ["a", "a"] } });
	});
});

describe("resolveBoard", () => {
	const cards = [
		{ id: "a", title: "A" },
		{ id: "b", title: "B" },
		{ id: "c", title: "C" },
	];

	it("按列顺序与列内顺序给出卡片，而不是卡片池的顺序", () => {
		const result = resolveBoard(
			{ columns: ["doing", "todo"], order: { todo: ["c", "a"], doing: ["b"] } },
			cards,
		);

		expect(result.map((column) => [column.id, column.cards.map((card) => card.id)])).toEqual([
			["doing", ["b"]],
			["todo", ["c", "a"]],
		]);
	});

	it("跳过卡片池里不存在的 id，未被排序引用的卡片不出现", () => {
		const result = resolveBoard(
			{ columns: ["todo"], order: { todo: ["a", "missing"] } },
			cards,
		);

		expect(result).toEqual([{ id: "todo", cards: [cards[0]] }]);
	});

	it("没有排序记录的列是空列", () => {
		expect(resolveBoard({ columns: ["todo"], order: {} }, cards)).toEqual([
			{ id: "todo", cards: [] },
		]);
	});

	it("重复的 id 只出现一次", () => {
		const result = resolveBoard(
			{ columns: ["todo", "doing"], order: { todo: ["a", "a"], doing: ["a", "b"] } },
			cards,
		);

		expect(result.map((column) => column.cards.map((card) => card.id))).toEqual([["a"], ["b"]]);
	});
});
