// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// 以纯文本读取源码：vitest 默认会把 CSS 导入替换为空串，站点根配置下同样如此。
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const board = read("./board.css");
const shell = read("./shell.css");
const switcher = read("./switcher.css");
const relations = read("./relations/relations.css");
const history = read("../history/history.css");
const canvas = read("../canvas/canvas.css");

/** 取选择器恰好为 `selector` 的规则块内容。 */
function rule(css: string, selector: string): string {
	// 格式化可能把长选择器拆成多行，所以空白按任意空白匹配
	const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
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

describe("看板外壳样式", () => {
	it("列体的裁剪层留出聚焦环的空间（内边距不少于 6px），以等量负外边距抵消，又不超出列与滚动层的内边距（17px）", () => {
		const inner = rule(shell, ".v-kanban .v-kanban__column-body-inner");

		expect(inner).toMatch(/overflow:\s*hidden/);
		const padding = Number(/padding:\s*(\d+)px/.exec(inner)?.[1]);
		const margin = Number(/margin:\s*-(\d+)px/.exec(inner)?.[1]);
		expect(padding).toBeGreaterThanOrEqual(6);
		expect(padding).toBeLessThanOrEqual(17);
		expect(margin).toBe(padding);
	});

	it("裁剪层盖到列头上却不接收指针事件，只让里面的内容接收", () => {
		expect(rule(shell, ".v-kanban .v-kanban__column-body-inner")).toMatch(
			/pointer-events:\s*none/,
		);
		expect(rule(shell, ".v-kanban .v-kanban__column-body-inner > *")).toMatch(
			/pointer-events:\s*auto/,
		);
	});

	it("折叠用行高过渡，不用位移或缩放；减弱动态下关闭所有折叠过渡", () => {
		expect(rule(shell, ".v-kanban .v-kanban__column-body")).toMatch(
			/grid-template-rows:\s*1fr[\s\S]*transition:\s*grid-template-rows 200ms/,
		);
		expect(shell).not.toMatch(/translate|slide/);
		const reduced =
			/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/.exec(shell)?.[1] ?? "";
		expect(reduced).toMatch(/transition:\s*none/);
		expect(reduced).toContain(".v-kanban__column-body");
	});

	it("折叠后内容隐藏且不可聚焦，但等动画结束后才隐藏", () => {
		const collapsed = rule(
			shell,
			'.v-kanban .v-kanban__column[data-collapsed="true"] > .v-kanban__column-body > .v-kanban__column-body-inner',
		);

		expect(collapsed).toMatch(/visibility:\s*hidden/);
		expect(collapsed).toMatch(/transition:\s*visibility 0s linear 200ms/);
	});
});

describe("列切换布局样式", () => {
	it("横向滚动的标签条留出聚焦环空间：内边距不少于 4px，并以等量负外边距抵消", () => {
		const list = rule(switcher, ".v-kanban .v-kanban__switcher");

		expect(list).toMatch(/overflow-x:\s*auto/);
		const padding = Number(/padding:\s*(\d+)px/.exec(list)?.[1]);
		const margin = Number(/margin:\s*-(\d+)px/.exec(list)?.[1]);
		expect(padding).toBeGreaterThanOrEqual(4);
		expect(margin).toBe(padding);
	});

	it("选中的标签有描边与背景两处区别，不只靠颜色", () => {
		const active = rule(switcher, '.v-kanban .v-kanban__tab[data-active="true"]');

		expect(active).toMatch(/border-color:/);
		expect(active).toMatch(/background:/);
	});

	it("标签的触控高度不小于 40px", () => {
		expect(
			Number(/min-height:\s*(\d+)px/.exec(rule(switcher, ".v-kanban .v-kanban__tab"))?.[1]),
		).toBeGreaterThanOrEqual(40);
	});

	it("一次只显示的列占满宽度", () => {
		expect(rule(switcher, '.v-kanban[data-layout="switcher"] .v-kanban__column')).toMatch(
			/flex:\s*1 1 100%/,
		);
	});
});

describe("关系线样式", () => {
	it("线型本身区分类型，不靠颜色：虚线有 dasharray，挡条与箭头是不同的终点标记", () => {
		expect(
			rule(
				relations,
				'.v-kanban .v-kanban__relation[data-line="dashed"] .v-kanban__relation-line',
			),
		).toMatch(/stroke-dasharray:\s*\d+ \d+/);
		expect(rule(relations, ".v-kanban .v-kanban__relation-head")).toMatch(
			/fill:\s*currentColor/,
		);
		expect(rule(relations, ".v-kanban .v-kanban__relation-bar")).toMatch(/stroke-width:\s*3/);
		// 实线与虚线共用同一条颜色，说明区分来自线型
		expect(rule(relations, ".v-kanban .v-kanban__relation-line")).toMatch(
			/stroke:\s*currentColor/,
		);
	});

	it("淡化只作用在卡片内容上，不给整个 li 加 opacity（否则固定定位的菜单与聚焦环会被一起拖淡）", () => {
		for (const css of [relations, shell]) {
			expect(css).not.toMatch(/\[data-(faded|dimmed)="true"\]\s*\{[^}]*opacity/);
			expect(css).toMatch(
				/\[data-(faded|dimmed)="true"\][\s\S]*?> :not\(\.v-kanban__card-tools/,
			);
		}
	});

	it("关系列表的样式不依赖 .v-kanban 祖先", () => {
		expect(relations).toMatch(/^\.v-kanban__relation-list \{/m);
		expect(relations).toMatch(/^\.v-kanban__relation-empty \{/m);
	});

	it("强制颜色模式下用系统色，减弱动态下不加过渡", () => {
		expect(relations).toMatch(/@media \(forced-colors: active\)/);
		expect(relations).toMatch(/@media \(prefers-reduced-motion: no-preference\)/);
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
	["shell.css", shell],
	["switcher.css", switcher],
	["relations.css", relations],
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
