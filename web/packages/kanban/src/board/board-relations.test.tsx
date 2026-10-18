import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Relation } from "../core/index.ts";
import { Board, type BoardColumn, type BoardProps } from "./board.tsx";
import { RelationList } from "./relations/relation-list.tsx";

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
		expect(within(card("a")).getByText(/Relations:/)).toBeTruthy();
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

describe("选中与高亮", () => {
	it("选中卡片：它和直接相连的卡片保持清晰，其余淡化；相关的线加粗，其余淡化", () => {
		renderBoard({ selectedCardId: "d" });

		expect(card("d").getAttribute("data-selected")).toBe("true");
		expect(card("d").getAttribute("aria-current")).toBe("true");
		expect(card("a").getAttribute("data-related")).toBe("true");
		expect(card("b").getAttribute("data-related")).toBe("true");
		expect(card("c").getAttribute("data-faded")).toBe("true");
		expect(card("e").getAttribute("data-faded")).toBe("true");
		expect(card("a").hasAttribute("data-faded")).toBe(false);
		expect(line("a", "d").getAttribute("data-state")).toBe("active");
		expect(line("e", "c").getAttribute("data-state")).toBe("faded");
	});

	it("没有选中时没有任何淡化", () => {
		renderBoard({ selectedCardId: null });

		expect(document.querySelector("[data-faded]")).toBeNull();
		expect(document.querySelector("[data-state]")).toBeNull();
	});

	it("选中一张没有任何关系的卡片：其余都淡化，没有线高亮", () => {
		renderBoard({ selectedCardId: "c", relations: [relations[0]] });

		expect(card("a").getAttribute("data-faded")).toBe("true");
		expect(card("c").getAttribute("data-selected")).toBe("true");
		expect(line("a", "d").getAttribute("data-state")).toBe("faded");
	});

	it("点击卡片选中，再点同一张取消；点击卡片里的按钮、链接或输入框不算", () => {
		const onSelect = vi.fn();
		function Harness() {
			const [selected, setSelected] = useState<string | null>(null);
			return (
				<Board
					columns={columns}
					cards={tasks}
					order={order}
					relations={relations}
					selectedCardId={selected}
					onSelectedCardChange={(id) => {
						onSelect(id);
						setSelected(id);
					}}
					renderCard={(task) => (
						<>
							<span>{task.title}</span>
							<button type="button">open {task.id}</button>
						</>
					)}
				/>
			);
		}
		render(<Harness />);

		fireEvent.click(card("d"));
		expect(onSelect).toHaveBeenLastCalledWith("d");
		expect(card("d").getAttribute("data-selected")).toBe("true");

		fireEvent.click(card("d"));
		expect(onSelect).toHaveBeenLastCalledWith(null);

		onSelect.mockClear();
		fireEvent.click(screen.getByRole("button", { name: "open a" }));
		expect(onSelect).not.toHaveBeenCalled();
	});

	it("点击看板的空白处取消选中；点列标题、列头按钮等不算", () => {
		const onSelect = vi.fn();
		renderBoard({
			selectedCardId: "d",
			onSelectedCardChange: onSelect,
			collapsible: true,
			onAddCard: () => {},
		});

		fireEvent.click(document.querySelector(".v-kanban__scroller") as HTMLElement);
		expect(onSelect).toHaveBeenCalledTimes(1);
		expect(onSelect).toHaveBeenLastCalledWith(null);
		fireEvent.click(document.querySelector('[data-column-id="todo"]') as HTMLElement);
		expect(onSelect).toHaveBeenCalledTimes(2);

		onSelect.mockClear();
		fireEvent.click(screen.getByRole("heading", { name: "Todo" }));
		fireEvent.click(screen.getByRole("button", { name: "Collapse Todo" }));
		fireEvent.click(
			within(document.querySelector('[data-column-id="todo"]') as HTMLElement).getByRole(
				"button",
				{ name: "Add card" },
			),
		);
		expect(onSelect).not.toHaveBeenCalled();
	});

	it("不可拖的卡片可以聚焦，Enter 或空格切换选中", () => {
		const onSelect = vi.fn();
		renderBoard({ onSelectedCardChange: onSelect });

		expect(card("a").getAttribute("tabindex")).toBe("0");
		fireEvent.keyDown(card("a"), { key: "Enter" });
		expect(onSelect).toHaveBeenLastCalledWith("a");
		fireEvent.keyDown(card("b"), { key: " " });
		expect(onSelect).toHaveBeenLastCalledWith("b");
	});

	it("可拖的卡片 Enter 仍是拿起，Alt+Enter 切换选中", () => {
		const onSelect = vi.fn();
		renderBoard({ onSelectedCardChange: onSelect, onMove: () => {} });

		fireEvent.keyDown(card("a"), { key: "Enter" });
		expect(card("a").getAttribute("data-lifted")).toBe("true");
		expect(onSelect).not.toHaveBeenCalled();
		fireEvent.keyDown(card("a"), { key: "Escape" });

		fireEvent.keyDown(card("b"), { key: "Enter", altKey: true });
		expect(onSelect).toHaveBeenCalledWith("b");
		expect(document.querySelector("[data-lifted]")).toBeNull();
	});

	it("可聚焦的卡片说明怎么选中：不可拖的说 Enter 或空格，可拖的说 Alt+Enter，并保留拿起的说明", () => {
		const { unmount } = renderBoard({ onSelectedCardChange: () => {} });
		const describedBy = (id: string) =>
			(card(id).getAttribute("aria-describedby") ?? "")
				.split(" ")
				.map((ref) => document.getElementById(ref)?.textContent ?? "");

		expect(describedBy("a")).toEqual([
			"Press Enter or Space to select this card and highlight its relations.",
		]);
		unmount();

		renderBoard({ onSelectedCardChange: () => {}, onMove: () => {} });
		const texts = describedBy("a");
		expect(texts).toHaveLength(2);
		expect(texts[0]).toMatch(/pick up/i);
		expect(texts[1]).toBe("Press Alt+Enter to select this card and highlight its relations.");
	});

	it("没有给 onSelectedCardChange 时点击不选中，卡片也不会变成可聚焦", () => {
		renderBoard();

		fireEvent.click(card("a"));

		expect(card("a").hasAttribute("tabindex")).toBe(false);
		expect(card("a").hasAttribute("data-selected")).toBe(false);
	});
});

describe("文本等价", () => {
	it("每张有关系的卡片带一段读屏文字：出向用类型文字，入向用反向文字", () => {
		renderBoard();

		expect(within(card("d")).getByText(/Relations:/).textContent).toBe(
			"Relations: is extended by Alpha; is fixed by Beta",
		);
		expect(within(card("a")).getByText(/Relations:/).textContent).toBe(
			"Relations: extends Delta",
		);
		expect(within(card("c")).getByText(/Relations:/).textContent).toBe(
			"Relations: is blocked by Epsilon",
		);
	});

	it("没有关系的卡片没有这段文字", () => {
		renderBoard({ relations: [relations[0]] });

		expect(within(card("b")).queryByText(/Relations:/)).toBeNull();
	});

	it("zh-CN", () => {
		renderBoard({ locale: "zh-CN" });

		expect(within(card("d")).getByText(/关系：/).textContent).toBe(
			"关系：被扩展 Alpha；被修复 Beta",
		);
	});

	it("RelationList 把关系读成「来源 类型 目标」的列表，可限定到一张卡片", () => {
		render(
			<RelationList
				relations={relations}
				cards={tasks}
				getCardLabel={(task) => task.title}
			/>,
		);

		expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
			"Alpha extends Delta",
			"Beta fixes Delta",
			"Epsilon blocks Gamma",
		]);
	});

	it("RelationList 限定到一张卡片时包含出入两个方向；没有关系时显示提示", () => {
		const { rerender } = render(
			<RelationList
				relations={relations}
				cards={tasks}
				cardId="d"
				getCardLabel={(task) => task.title}
			/>,
		);
		expect(screen.getAllByRole("listitem")).toHaveLength(2);

		rerender(<RelationList relations={[]} cards={tasks} locale="zh-CN" />);
		expect(screen.getByText("暂无关系")).toBeTruthy();
	});
});
