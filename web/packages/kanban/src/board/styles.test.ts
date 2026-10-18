// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// 以纯文本读取源码：vitest 默认会把 CSS 导入替换为空串，站点根配置下同样如此。
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const board = read("./board.css");
const history = read("../history/history.css");
const canvas = read("../canvas/canvas.css");

/** 取选择器恰好为 `selector` 的规则块内容。 */
function rule(css: string, selector: string): string {
	const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(css);
	if (!match) throw new Error(`Missing rule: ${selector}`);
	return match[1];
}

describe("看板样式", () => {
	it("横向滚动层留出聚焦环空间：内边距不少于 4px，并以等量负外边距抵消", () => {
		const scroller = rule(board, ".v-kanban .v-kanban__scroller");

		expect(scroller).toMatch(/overflow-x:\s*auto/);
		const padding = Number(/padding:\s*(\d+)px/.exec(scroller)?.[1]);
		const margin = Number(/margin:\s*-(\d+)px/.exec(scroller)?.[1]);
		expect(padding).toBeGreaterThanOrEqual(4);
		expect(margin).toBe(padding);
	});

	it("字体默认继承宿主", () => {
		expect(rule(board, ".v-kanban")).toMatch(
			/font-family:\s*var\(--kanban-font-family,\s*inherit\)/,
		);
	});

	it("圆角上限由变量封顶在 16px", () => {
		expect(board).toMatch(/--_kanban-radius:\s*min\([^;]*,\s*16px\)/);
	});
});

describe("画布样式", () => {
	it("触摸手势归画布：touch-action: none 落在视口与它的每个后代上（内容里的滚动容器会截断继承）", () => {
		expect(canvas).toMatch(
			/\.v-kanban-canvas \.v-kanban-canvas__viewport,\s*\.v-kanban-canvas \.v-kanban-canvas__viewport \*\s*\{[^}]*touch-action:\s*none/,
		);
	});

	it("视口用 overflow: clip，不成为滚动容器，聚焦视口外的元素时浏览器不会原生滚动它", () => {
		const viewport = rule(canvas, ".v-kanban-canvas .v-kanban-canvas__viewport");

		expect(viewport).toMatch(/overflow:\s*clip/);
		expect(viewport).not.toMatch(/overflow(-[xy])?:\s*(hidden|auto|scroll)/);
	});
});

describe.each([
	["board.css", board],
	["history.css", history],
	["canvas.css", canvas],
])("%s 的视觉红线", (_name, css) => {
	it("不使用 scale；阴影只有一种轻微软影或没有", () => {
		expect(css).not.toMatch(/scale/);
		const shadows = [...css.matchAll(/box-shadow:\s*([^;]+);/g)].map((match) => match[1]);

		expect(shadows.filter((shadow) => shadow !== "0 4px 24px rgb(0 0 0 / 0.05)")).toEqual([]);
	});

	it("字面圆角不超过 16px（胶囊除外）", () => {
		const radii = [...css.matchAll(/border-radius:\s*(\d+)px/g)].map((match) =>
			Number(match[1]),
		);

		expect(radii.filter((radius) => radius !== 9999 && radius > 16)).toEqual([]);
	});

	it("只引用 --kanban-* 变量，不依赖宿主的主题变量名", () => {
		const references = [...css.matchAll(/var\(\s*(--[\w-]+)/g)].map((match) => match[1]);

		expect(references.length).toBeGreaterThan(0);
		expect(references.filter((name) => !/^--_?kanban-/.test(name))).toEqual([]);
	});
});

it("看板阴影只有软影一种配方", () => {
	const shadows = [...board.matchAll(/box-shadow:\s*([^;]+);/g)].map((match) => match[1]);

	expect(shadows.length).toBeGreaterThan(0);
	expect(new Set(shadows)).toEqual(new Set(["0 4px 24px rgb(0 0 0 / 0.05)"]));
});
