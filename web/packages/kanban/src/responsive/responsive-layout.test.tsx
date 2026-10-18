import { act, render, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Board } from "../board/board.tsx";
import { DEFAULT_NARROW_BREAKPOINT, ResponsiveLayout } from "./responsive-layout.tsx";

let width = 1000;
let observers: Array<() => void> = [];

beforeEach(() => {
	width = 1000;
	observers = [];
	vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(() => width);
	vi.stubGlobal(
		"ResizeObserver",
		class {
			constructor(callback: () => void) {
				observers.push(callback);
			}
			observe() {}
			unobserve() {}
			disconnect() {}
		},
	);
});
afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

/** 容器宽度变化，并通知所有 ResizeObserver。 */
const resizeTo = (next: number) => {
	width = next;
	act(() => {
		for (const callback of observers) callback();
	});
};

const layouts = (props: Partial<Parameters<typeof ResponsiveLayout>[0]> = {}) => (
	<ResponsiveLayout narrow={<p>narrow content</p>} {...props}>
		<p>wide content</p>
	</ResponsiveLayout>
);
const root = () => document.querySelector(".v-kanban-responsive") as HTMLElement;

describe("按容器宽度选择内容", () => {
	it("宽度不小于阈值用宽屏内容，小于阈值用窄屏内容；阈值默认 768", () => {
		expect(DEFAULT_NARROW_BREAKPOINT).toBe(768);
		width = 768;
		const wide = render(layouts());
		expect(screen.queryByText("wide content")).not.toBeNull();
		expect(screen.queryByText("narrow content")).toBeNull();
		wide.unmount();

		width = 767;
		render(layouts());
		expect(screen.queryByText("narrow content")).not.toBeNull();
		expect(screen.queryByText("wide content")).toBeNull();
	});

	it("两份内容从不同时挂载", () => {
		render(layouts());

		expect(screen.getAllByText(/content/)).toHaveLength(1);
		resizeTo(390);
		expect(screen.getAllByText(/content/)).toHaveLength(1);
	});

	it("breakpoint 可配置", () => {
		width = 650;
		const view = render(layouts({ breakpoint: 600 }));
		expect(root().getAttribute("data-layout")).toBe("wide");

		width = 599;
		view.rerender(layouts({ breakpoint: 600 }));
		resizeTo(599);
		expect(root().getAttribute("data-layout")).toBe("narrow");

		view.rerender(layouts({ breakpoint: 500 }));
		expect(root().getAttribute("data-layout")).toBe("wide");
	});

	it("容器尺寸变化时来回切换，根节点标出当前布局", () => {
		render(layouts());
		expect(root().getAttribute("data-layout")).toBe("wide");

		resizeTo(500);
		expect(root().getAttribute("data-layout")).toBe("narrow");
		expect(screen.queryByText("narrow content")).not.toBeNull();

		resizeTo(900);
		expect(root().getAttribute("data-layout")).toBe("wide");
		expect(screen.queryByText("wide content")).not.toBeNull();
	});

	it("容器不可见（宽度为 0）时保持现状，不当作窄屏", () => {
		render(layouts());

		resizeTo(0);

		expect(root().getAttribute("data-layout")).toBe("wide");
		resizeTo(300);
		resizeTo(0);
		expect(root().getAttribute("data-layout")).toBe("narrow");
	});

	it("没有 ResizeObserver 的环境里只量一次，不报错", () => {
		vi.stubGlobal("ResizeObserver", undefined);
		width = 400;

		render(layouts());

		expect(root().getAttribute("data-layout")).toBe("narrow");
	});

	it("其余 div 属性与 className 落在根节点", () => {
		render(layouts({ className: "mine", "aria-label": "roadmap", id: "roadmap" }));

		expect(root().className).toBe("v-kanban-responsive mine");
		expect(root().getAttribute("aria-label")).toBe("roadmap");
		expect(root().id).toBe("roadmap");
	});
});

describe("onLayoutChange", () => {
	it("宽屏挂载不通知；布局变化时通知，同一布局内的尺寸变化不通知", () => {
		const onLayoutChange = vi.fn();
		render(layouts({ onLayoutChange }));
		expect(onLayoutChange).not.toHaveBeenCalled();

		resizeTo(600);
		resizeTo(500);
		expect(onLayoutChange).toHaveBeenCalledExactlyOnceWith("narrow");

		resizeTo(1200);
		expect(onLayoutChange).toHaveBeenLastCalledWith("wide");
		expect(onLayoutChange).toHaveBeenCalledTimes(2);
	});

	it("挂载时就是窄屏也通知一次", () => {
		const onLayoutChange = vi.fn();
		width = 390;

		render(layouts({ onLayoutChange }));

		expect(onLayoutChange).toHaveBeenCalledExactlyOnceWith("narrow");
	});
});

describe("服务端渲染", () => {
	it("服务端与水合的首次渲染是宽屏内容，水合不报错，随后换成窄屏内容", async () => {
		const tree = layouts();
		const container = document.createElement("div");
		container.innerHTML = renderToString(tree);
		document.body.append(container);
		expect(container.textContent).toBe("wide content");
		const errors = vi.spyOn(console, "error").mockImplementation(() => {});
		const recoverable = vi.fn();
		width = 390;

		await act(async () => {
			hydrateRoot(container, tree, { onRecoverableError: recoverable });
		});

		expect(errors).not.toHaveBeenCalled();
		expect(recoverable).not.toHaveBeenCalled();
		expect(container.textContent).toBe("narrow content");
		container.remove();
	});
});

describe("与看板搭配", () => {
	const columns = [
		{ id: "todo", title: "Planned" },
		{ id: "done", title: "Done" },
	];
	const cards = [
		{ id: "a", title: "Task A" },
		{ id: "b", title: "Task B" },
	];
	const order = { todo: ["a"], done: ["b"] };
	const board = (layout: "columns" | "switcher") => (
		<Board
			layout={layout}
			columns={columns}
			cards={cards}
			order={order}
			renderCard={(card) => <span>{card.title}</span>}
		/>
	);

	it("宽屏各列并排，窄屏换成列切换器，卡片数据不变", () => {
		render(<ResponsiveLayout narrow={board("switcher")}>{board("columns")}</ResponsiveLayout>);
		expect(screen.queryByRole("tablist")).toBeNull();
		expect(screen.getByText("Task A")).not.toBeNull();
		expect(screen.getByText("Task B")).not.toBeNull();

		resizeTo(390);

		expect(screen.getByRole("tablist")).not.toBeNull();
		expect(screen.getByText("Task A")).not.toBeNull();
		expect(screen.queryByText("Task B")).toBeNull();
	});

	it("受控的 activeColumn 让切换器在窄宽之间切换时延续显示的列", () => {
		const view = render(
			<ResponsiveLayout
				narrow={
					<Board
						layout="switcher"
						activeColumn="done"
						columns={columns}
						cards={cards}
						order={order}
						renderCard={(card) => <span>{card.title}</span>}
					/>
				}
			>
				{board("columns")}
			</ResponsiveLayout>,
		);

		resizeTo(390);
		expect(screen.getByText("Task B")).not.toBeNull();
		resizeTo(1000);
		resizeTo(390);

		expect(screen.getByText("Task B")).not.toBeNull();
		view.unmount();
	});
});
