import { describe, expect, it } from "vitest";

import {
	countAlive,
	createBoard,
	GLIDER,
	type LifeBoard,
	resizeBoard,
	seedCorners,
	stampPattern,
	stepBoard,
} from "./life";

function aliveAt(board: LifeBoard): string[] {
	const alive: string[] = [];
	board.cells.forEach((cell, index) => {
		if (cell) alive.push(`${index % board.cols},${Math.floor(index / board.cols)}`);
	});
	return alive;
}

describe("stepBoard", () => {
	it("闪烁器在横竖之间往复", () => {
		const board = createBoard(5, 5);
		stampPattern(
			board.cells,
			5,
			5,
			[
				[1, 2],
				[2, 2],
				[3, 2],
			],
			0,
			0,
		);

		const vertical = stepBoard(board);
		expect(aliveAt(vertical)).toEqual(["2,1", "2,2", "2,3"]);
		expect(aliveAt(stepBoard(vertical))).toEqual(aliveAt(board));
	});

	it("滑翔机四代后整体右下平移一格并越界绕回", () => {
		let board = createBoard(6, 6);
		stampPattern(board.cells, 6, 6, GLIDER, 4, 4);
		const start = aliveAt(board);

		for (let generation = 0; generation < 4; generation++) board = stepBoard(board);

		const shifted = start.map((key) => {
			const [x, y] = key.split(",").map(Number);
			return `${(x + 1) % 6},${(y + 1) % 6}`;
		});
		expect(aliveAt(board).sort()).toEqual(shifted.sort());
	});
});

describe("stampPattern", () => {
	it("翻转后滑翔机朝左上滑行", () => {
		let board = createBoard(12, 12);
		stampPattern(board.cells, 12, 12, GLIDER, 6, 6, true, true);
		const start = aliveAt(board);

		for (let generation = 0; generation < 4; generation++) board = stepBoard(board);

		const shifted = start.map((key) => {
			const [x, y] = key.split(",").map(Number);
			return `${x - 1},${y - 1}`;
		});
		expect(aliveAt(board).sort()).toEqual(shifted.sort());
	});
});

describe("resizeBoard", () => {
	it("保留重叠区域的细胞", () => {
		const board = createBoard(4, 4);
		stampPattern(
			board.cells,
			4,
			4,
			[
				[0, 0],
				[3, 3],
				[1, 2],
			],
			0,
			0,
		);

		const resized = resizeBoard(board, 3, 5);

		expect(resized.cols).toBe(3);
		expect(resized.rows).toBe(5);
		expect(aliveAt(resized)).toEqual(["0,0", "1,2"]);
	});
});

describe("seedCorners", () => {
	it("只在右上与左下两角撒细胞", () => {
		const board = createBoard(40, 30);
		seedCorners(board, () => 0);

		expect(countAlive(board.cells)).toBeGreaterThan(0);
		expect(board.cells[0]).toBe(0);
		expect(board.cells[39]).toBe(1);
		expect(board.cells[29 * 40]).toBe(1);
		expect(board.cells[29 * 40 + 39]).toBe(0);
		expect(board.cells[15 * 40 + 20]).toBe(0);
	});
});
