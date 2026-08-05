/**
 * markdown-position 纯函数单测。
 *
 * 覆盖：空文档、纯文本、含图片/公式块（占一行 markdown）、含代码块（多行）、
 * 文档末尾越界、二分查找边界、findVisibleBlockPos 各分支。
 */
import { describe, expect, it } from "vitest";
import {
	type BlockLineEntry,
	buildBlockLineMap,
	findBlockByLine,
	findVisibleBlockPos,
} from "../markdown-position";

describe("buildBlockLineMap", () => {
	it("空数组返回空映射", () => {
		expect(buildBlockLineMap([])).toEqual<BlockLineEntry[]>([]);
	});

	it("单块单行", () => {
		const map = buildBlockLineMap([[0, "# 标题"]]);
		expect(map).toEqual<BlockLineEntry[]>([{ pmPos: 0, mdStartLine: 0, mdEndLine: 0 }]);
	});

	it("多块累计行号,计入块间空行（整体 MD 用 \\n\\n 分隔）", () => {
		// 段落 1 行、图片 1 行、段落 1 行;块间各 1 个空行
		// 整体 MD: "段落 A\n\n![alt](url)\n\n段落 B"
		//   [0]段落A [1]空 [2]图片 [3]空 [4]段落B
		// mdEndLine 含尾随空行,区间连续(空行归上一个块,保守)
		const map = buildBlockLineMap([
			[0, "段落 A"],
			[10, "![alt](url)"],
			[20, "段落 B"],
		]);
		expect(map).toEqual<BlockLineEntry[]>([
			{ pmPos: 0, mdStartLine: 0, mdEndLine: 1 },
			{ pmPos: 10, mdStartLine: 2, mdEndLine: 3 },
			{ pmPos: 20, mdStartLine: 4, mdEndLine: 4 },
		]);
	});

	it("多行块（代码块 fence）累计正确", () => {
		// codeBlock 4 行;块间各 1 空行
		// 整体: "前言\n\n```js\n...\n```\n\n后记"
		//   [0]前言 [1]空 [2]```js [3]const a [4]const b [5]``` [6]空 [7]后记
		const codeBlock = "```js\nconst a = 1;\nconst b = 2;\n```"; // 4 行
		const map = buildBlockLineMap([
			[0, "前言"],
			[10, codeBlock],
			[30, "后记"],
		]);
		expect(map).toEqual<BlockLineEntry[]>([
			{ pmPos: 0, mdStartLine: 0, mdEndLine: 1 },
			{ pmPos: 10, mdStartLine: 2, mdEndLine: 6 },
			{ pmPos: 30, mdStartLine: 7, mdEndLine: 7 },
		]);
	});

	it("公式块（多行 latex）累计正确", () => {
		// mathBlock 3 行;块间 1 空行
		// 整体: "$$\nE = mc^2\n$$\n\n说明"
		//   [0]$$ [1]E=mc^2 [2]$$ [3]空 [4]说明
		const mathBlock = "$$\nE = mc^2\n$$"; // 3 行
		const map = buildBlockLineMap([
			[0, mathBlock],
			[20, "说明"],
		]);
		expect(map).toEqual<BlockLineEntry[]>([
			{ pmPos: 0, mdStartLine: 0, mdEndLine: 3 },
			{ pmPos: 20, mdStartLine: 4, mdEndLine: 4 },
		]);
	});

	it("自定义分隔符(单 \\n,无空行)累计为旧版行为", () => {
		const map = buildBlockLineMap(
			[
				[0, "A"],
				[10, "B"],
			],
			"\n",
		);
		expect(map).toEqual<BlockLineEntry[]>([
			{ pmPos: 0, mdStartLine: 0, mdEndLine: 0 },
			{ pmPos: 10, mdStartLine: 1, mdEndLine: 1 },
		]);
	});
});

describe("findBlockByLine", () => {
	// 对应 buildBlockLineMap([[0,"前言"],[10,codeBlock4行],[30,"后记"]])
	// 整体 MD 行布局:
	//   [0]前言 [1]空 [2]```js [3]const a [4]const b [5]``` [6]空 [7]后记
	// mdEndLine 含尾随空行,区间连续覆盖 [0..7]
	const map: BlockLineEntry[] = [
		{ pmPos: 0, mdStartLine: 0, mdEndLine: 1 },
		{ pmPos: 10, mdStartLine: 2, mdEndLine: 6 },
		{ pmPos: 30, mdStartLine: 7, mdEndLine: 7 },
	];

	it("空映射返回 null", () => {
		expect(findBlockByLine([], 5)).toBeNull();
	});

	it("行落在块内(含尾随空行)返回该块 pos", () => {
		expect(findBlockByLine(map, 0)).toBe(0); // 前言
		expect(findBlockByLine(map, 1)).toBe(0); // 空行,归上一个块
		expect(findBlockByLine(map, 2)).toBe(10); // 代码块 ```js
		expect(findBlockByLine(map, 5)).toBe(10); // 代码块 ```
		expect(findBlockByLine(map, 6)).toBe(10); // 空行,归上一个块
		expect(findBlockByLine(map, 7)).toBe(30); // 后记
	});

	it("行号越界（文档末尾之后）返回最后一块 pos", () => {
		expect(findBlockByLine(map, 100)).toBe(30);
	});

	it("负行号兜底返回首块 pos", () => {
		expect(findBlockByLine(map, -5)).toBe(0);
	});
});

describe("findVisibleBlockPos", () => {
	it("空序列返回 null", () => {
		expect(findVisibleBlockPos([])).toBeNull();
	});

	it("返回第一个 bottom > 0 的块（视口顶部可见块）", () => {
		const blocks: Array<[number, number]> = [
			[0, -100], // 已滚出视口顶部
			[10, -20], // 即将滚出
			[20, 5], // 底边刚进入视口 ← 命中
			[30, 200],
		];
		expect(findVisibleBlockPos(blocks)).toBe(20);
	});

	it("全部已在视口上方（bottom ≤ 0）返回最后一块", () => {
		const blocks: Array<[number, number]> = [
			[0, -100],
			[10, -50],
		];
		expect(findVisibleBlockPos(blocks)).toBe(10);
	});

	it("首块即命中（视口在文档顶部）", () => {
		const blocks: Array<[number, number]> = [
			[0, 30],
			[10, 100],
		];
		expect(findVisibleBlockPos(blocks)).toBe(0);
	});
});
