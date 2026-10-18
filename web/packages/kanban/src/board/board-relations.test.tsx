import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Relation } from "../core/index.ts";
import { Board, type BoardColumn, type BoardProps } from "./board.tsx";

interface Task {
	id: string;
	title: string;
}

const tasks: Task[] = [
	{ id: "a", title: "Alpha" },
	{ id: "b", title: "Beta" },
	{ id: "c", title: "Gamma" },
	{ id: "d", title: "Delta" },
	{ id: "e", title: "Epsilon" },
];
const columns: BoardColumn[] = [
	{ id: "todo", title: "Todo" },
	{ id: "doing", title: "Doing" },
	{ id: "done", title: "Done" },
];
const order = { todo: ["a", "b", "c"], doing: ["d"], done: ["e"] };
const relations: Relation[] = [
	{ sourceId: "a", targetId: "d", type: "extends" },
	{ sourceId: "b", targetId: "d", type: "fixes" },
	{ sourceId: "e", targetId: "c", type: "blocks" },
];

/** jsdom 没有布局：列横排（宽 180、间距 20），卡片竖排（160×50、间距 10）。 */
let hidden = new Set<string>();
function stubLayout() {
	return vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
		this: Element,
	) {
		const rect = (left: number, top: number, width: number, height: number) =>
			({
				left,
				top,
				width,
				height,
				right: left + width,
				bottom: top + height,
				x: left,
				y: top,
				toJSON() {},
			}) as DOMRect;
		const column = this.closest("[data-column-id]") as HTMLElement | null;
		if (!column) return rect(0, 0, 0, 0);
		const index = [...(column.parentElement as HTMLElement).children].indexOf(column);
		if (this === column) return rect(index * 200, 0, 180, 600);
		const item = this.closest("[data-card-id]") as HTMLElement | null;
		if (!item || hidden.has(item.getAttribute("data-card-id") ?? "")) return rect(0, 0, 0, 0);
		const list = item.parentElement as HTMLElement;
		const slot = [...list.children]
			.filter((child) => !child.hasAttribute("data-origin"))
			.indexOf(item);
		return rect(index * 200 + 10, 50 + slot * 60, 160, 50);
	});
}

type Props = Partial<BoardProps<Task, BoardColumn>>;
function renderBoard(props: Props = {}) {
	return render(
		<Board
			columns={columns}
			cards={tasks}
			order={order}
			relations={relations}
			getCardLabel={(task) => task.title}
			renderCard={(task) => <span>{task.title}</span>}
			{...props}
		/>,
	);
}

const layer = () => document.querySelector(".v-kanban__relations");
const lines = () => [...document.querySelectorAll<SVGGElement>(".v-kanban__relation")];
const line = (source: string, target: string) =>
	lines().find(
		(element) =>
			element.getAttribute("data-source") === source &&
			element.getAttribute("data-target") === target,
	) as SVGGElement;
const card = (id: string) => document.querySelector(`[data-card-id="${id}"]`) as HTMLElement;
/** 路径的起点 M x y。 */
const startOf = (element: SVGGElement) => {
	const d = element.querySelector("path.v-kanban__relation-line")?.getAttribute("d") ?? "";
	const [x, y] = d.replace("M ", "").split(" C")[0].split(" ").map(Number);
	return { x, y };
};

let restore: () => void;
beforeEach(() => {
	hidden = new Set();
	restore = (() => {
		const spy = stubLayout();
		return () => spy.mockRestore();
	})();
});
afterEach(() => restore());

describe("关系线", () => {
	it("每条关系一根线，按来源右缘中点到目标左缘中点连接；叠加层对读屏隐藏且不拦截指针", () => {
		renderBoard();

		expect(lines()).toHaveLength(3);
		expect(layer()?.getAttribute("aria-hidden")).toBe("true");
		// a 在 todo 第 1 个：右缘 x=170，中线 y=75；d 在 doing 第 1 个
		expect(startOf(line("a", "d"))).toEqual({ x: 170, y: 75 });
		// b 在 todo 第 2 个：中线 y=135
		expect(startOf(line("b", "d"))).toEqual({ x: 170, y: 135 });
	});

	it("线型随类型：扩展实线、修复虚线、阻塞实线加挡条；箭头与挡条是不同的终点标记", () => {
		renderBoard();

		expect(line("a", "d").getAttribute("data-line")).toBe("solid");
		expect(line("b", "d").getAttribute("data-line")).toBe("dashed");
		expect(line("e", "c").getAttribute("data-line")).toBe("blocker");
		expect(line("a", "d").querySelector(".v-kanban__relation-head")).not.toBeNull();
		expect(line("a", "d").querySelector(".v-kanban__relation-bar")).toBeNull();
		expect(line("e", "c").querySelector(".v-kanban__relation-bar")).not.toBeNull();
		expect(line("e", "c").querySelector(".v-kanban__relation-head")).toBeNull();
		expect(line("a", "d").getAttribute("data-relation-type")).toBe("extends");
	});

	it("线的提示文字读作「来源 类型 目标」", () => {
		renderBoard();

		expect(line("a", "d").querySelector("title")?.textContent).toBe("Alpha extends Delta");
		expect(line("e", "c").querySelector("title")?.textContent).toBe("Epsilon blocks Gamma");
	});

	it("使用方的类型映射覆盖默认线型与文字，未知类型按实线处理并用类型名当文字", () => {
		renderBoard({
			relations: [
				{ sourceId: "a", targetId: "d", type: "extends" },
				{ sourceId: "b", targetId: "d", type: "related" },
			],
			relationTypes: {
				extends: { label: "builds on", inverseLabel: "is built on by", line: "dashed" },
			},
		});

		expect(line("a", "d").getAttribute("data-line")).toBe("dashed");
		expect(line("a", "d").querySelector("title")?.textContent).toBe("Alpha builds on Delta");
		expect(line("b", "d").getAttribute("data-line")).toBe("solid");
		expect(line("b", "d").querySelector("title")?.textContent).toBe("Beta related Delta");
	});

	it("类型名恰好是 Object 原型上的键（constructor、toString）也按未知类型处理", () => {
		renderBoard({
			relations: [
				{ sourceId: "a", targetId: "d", type: "constructor" },
				{ sourceId: "b", targetId: "d", type: "toString" },
			],
		});

		expect(line("a", "d").getAttribute("data-line")).toBe("solid");
		expect(line("a", "d").querySelector("title")?.textContent).toBe("Alpha constructor Delta");
		expect(line("b", "d").querySelector("title")?.textContent).toBe("Beta toString Delta");
	});

	it("重复的关系或带冒号的 id 不会产生重复的 key 警告", () => {
		const errors = vi.spyOn(console, "error").mockImplementation(() => {});
		renderBoard({
			relations: [
				{ sourceId: "a", targetId: "d", type: "extends" },
				{ sourceId: "a", targetId: "d", type: "extends" },
			],
		});

		expect(errors).not.toHaveBeenCalled();
		expect(lines()).toHaveLength(2);
		errors.mockRestore();
	});

	it("定位写在叠加层与滚动层的行内样式上：不加载样式表（/unstyled）也能画", () => {
		renderBoard();

		const svg = layer() as SVGElement;
		expect(svg.style.position).toBe("absolute");
		expect(svg.style.overflow).toBe("visible");
		expect(svg.style.pointerEvents).toBe("none");
		expect((document.querySelector(".v-kanban__scroller") as HTMLElement).style.position).toBe(
			"relative",
		);
	});

	it("zh-CN 默认类型文字", () => {
		renderBoard({ locale: "zh-CN" });

		expect(line("a", "d").querySelector("title")?.textContent).toBe("Alpha 扩展 Delta");
		expect(line("e", "c").querySelector("title")?.textContent).toBe("Epsilon 阻塞 Gamma");
	});

	it("hideRelations 隐藏全部连线，文本描述仍在", () => {
		renderBoard({ hideRelations: true });

		expect(layer()).toBeNull();
	});

	it("没有关系时不渲染叠加层", () => {
		renderBoard({ relations: [] });

		expect(layer()).toBeNull();
	});

	it("端点不可见（在折叠的列里、卡片不存在、没有布局）的关系不画线", () => {
		renderBoard({
			collapsible: true,
			defaultCollapsedColumns: ["doing"],
			relations: [...relations, { sourceId: "a", targetId: "missing", type: "extends" }],
		});

		expect(line("a", "d")).toBeUndefined();
		expect(line("b", "d")).toBeUndefined();
		expect(line("e", "c")).toBeDefined();
		expect(lines()).toHaveLength(1);
	});

	it("卡片位置变化后线跟着走", () => {
		const { rerender } = renderBoard();
		expect(startOf(line("a", "d"))).toEqual({ x: 170, y: 75 });

		rerender(
			<Board
				columns={columns}
				cards={tasks}
				order={{ todo: ["b", "a", "c"], doing: ["d"], done: ["e"] }}
				relations={relations}
				renderCard={(task) => <span>{task.title}</span>}
			/>,
		);

		expect(startOf(line("a", "d"))).toEqual({ x: 170, y: 135 });
	});
});
