import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArticleTocRail } from "./ArticleTocRail";
import { SegmentedArticleToc } from "./SegmentedArticleToc";

const preferences = vi.hoisted(() => ({ reduced: false }));
vi.mock("motion/react", () => ({ useReducedMotion: () => preferences.reduced }));

let frames: Map<number, FrameRequestCallback>;
let clock: number;
let nextFrame: number;
let resizeCallbacks: Set<ResizeObserverCallback>;
let listHeight: number;
let viewportHeight: number;
let railHeight: number;
let quantum: number;
let positions: WeakMap<Element, number>;
let heightReads: number;

const items = Array.from({ length: 25 }, (_, index) => ({
	id: `section-${index}`,
	title: `章节 ${index}`,
	depth: 0,
	topId: `section-${index}`,
}));

function settle() {
	let count = 0;
	while (frames.size && count < 600) {
		act(() => {
			clock += 1000 / 60;
			const pending = [...frames.values()];
			frames.clear();
			for (const callback of pending) callback(clock);
		});
		count++;
	}
	expect(frames.size).toBe(0);
}

function resize() {
	act(() => {
		for (const callback of resizeCallbacks) callback([], {} as ResizeObserver);
	});
}

function renderDirectory() {
	const body = document.createElement("article");
	for (const [index, item] of items.entries()) {
		const heading = document.createElement("h2");
		heading.id = item.id;
		vi.spyOn(heading, "getBoundingClientRect").mockImplementation(
			() => ({ top: 80 + index * 500 - window.scrollY }) as DOMRect,
		);
		body.append(heading);
	}
	const view = render(
		<SegmentedArticleToc
			nodes={items}
			activeId={items[0].id}
			onNavigate={vi.fn()}
			contentRef={{ current: body }}
			isRailCollapsedAtRest
		/>,
	);
	const scroller = view.container.querySelector<HTMLElement>("[data-toc-accordion]");
	if (!scroller) throw new Error("目录未渲染");
	return { ...view, scroller };
}

beforeEach(() => {
	frames = new Map();
	clock = 0;
	nextFrame = 0;
	resizeCallbacks = new Set();
	listHeight = 900;
	viewportHeight = 300;
	railHeight = 400;
	quantum = 0;
	positions = new WeakMap();
	heightReads = 0;
	preferences.reduced = false;
	vi.stubGlobal("CSS", { escape: (value: string) => value });
	vi.stubGlobal("scrollY", 0);
	vi.stubGlobal("innerHeight", 1000);
	vi.spyOn(document, "hidden", "get").mockReturnValue(false);
	vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
		frames.set(++nextFrame, callback);
		return nextFrame;
	});
	vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
	vi.stubGlobal(
		"ResizeObserver",
		class {
			constructor(private callback: ResizeObserverCallback) {
				resizeCallbacks.add(callback);
			}
			observe() {}
			disconnect() {
				resizeCallbacks.delete(this.callback);
			}
		},
	);
	vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (
		this: HTMLElement,
	) {
		heightReads++;
		return this.hasAttribute("data-toc-rail") ? railHeight : viewportHeight;
	});
	vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(() => listHeight);
	vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (
		this: HTMLElement,
	) {
		return this.tagName === "LI" ? 36 : 13000;
	});
	vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementation(function (
		this: HTMLElement,
	) {
		return this.tagName === "LI" && this.parentElement
			? Array.from(this.parentElement.querySelectorAll<HTMLElement>("li")).indexOf(this) * 36
			: 0;
	});
	vi.spyOn(Element.prototype, "scrollTop", "get").mockImplementation(function (this: Element) {
		return positions.get(this) ?? 0;
	});
	vi.spyOn(Element.prototype, "scrollTop", "set").mockImplementation(function (
		this: Element,
		value: number,
	) {
		const rounded = quantum ? Math.round(value / quantum) * quantum : value;
		positions.set(
			this,
			Math.min(Math.max(0, listHeight - viewportHeight), Math.max(0, rounded)),
		);
	});
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("目录滚动趋近", () => {
	it("页首不可达的负目标在零处停止，页尾在合法上界停止", () => {
		const { scroller } = renderDirectory();
		settle();
		expect(scroller.scrollTop).toBe(0);
		vi.stubGlobal("scrollY", 13000);
		fireEvent.scroll(window);
		settle();
		expect(scroller.scrollTop).toBe(600);
	});

	it.each([1, 0.25])("scrollTop 按 %s 像素取整时仍到达阅读位置并停止", (step) => {
		quantum = step;
		const { scroller } = renderDirectory();
		vi.stubGlobal("scrollY", 5000);
		fireEvent.scroll(window);
		settle();
		expect(scroller.scrollTop).toBeGreaterThan(200);
		expect(scroller.scrollTop).toBeLessThan(300);
	});

	it("缩放或内容展开改变滚动范围后重新钳制，展开目录仍能定位当前阅读位置", () => {
		const { scroller } = renderDirectory();
		vi.stubGlobal("scrollY", 13000);
		fireEvent.scroll(window);
		settle();
		viewportHeight = 500;
		resize();
		settle();
		expect(scroller.scrollTop).toBe(400);
		listHeight = 1100;
		resize();
		settle();
		expect(scroller.scrollTop).toBe(600);
		fireEvent.mouseEnter(
			screen.getByRole("group", {
				name: "文章目录；悬停或聚焦以展开完整目录",
			}),
		);
		settle();
		expect(scroller.scrollTop).toBe(600);
	});
});

describe("阅读轨迹静止", () => {
	it("保留弯曲轨迹，收敛后不读尺寸、不再写 SVG；滚动和进度更新可唤醒", () => {
		const view = render(
			<ArticleTocRail items={items} activeId={items[0].id} active readPercent={40} />,
		);
		const readsAfterMount = heightReads;
		settle();
		expect(heightReads).toBe(readsAfterMount);
		const path = view.container.querySelector('[data-toc-rail-path="base"]');
		expect(path?.getAttribute("d")).toContain("C8");
		const before = path?.getAttribute("d");
		const writes = vi.spyOn(Element.prototype, "setAttribute");
		fireEvent.scroll(window);
		settle();
		expect(writes).not.toHaveBeenCalled();
		view.rerender(
			<ArticleTocRail items={items} activeId={items[1].id} active readPercent={60} />,
		);
		settle();
		expect(path?.getAttribute("d")).not.toBe(before);
		vi.stubGlobal("scrollY", 1000);
		fireEvent.scroll(window);
		settle();
		expect(frames.size).toBe(0);
	});

	it("尺寸、节点及展开状态变化后更新并再次停止", () => {
		const view = render(
			<ArticleTocRail items={items} activeId={items[0].id} active readPercent={50} />,
		);
		settle();
		railHeight = 600;
		resize();
		settle();
		expect(
			view.container.querySelector('[data-toc-rail-path="base"]')?.getAttribute("d"),
		).toContain("L8 600");
		const nextItems = [items[0], items[12], items[24]];
		view.rerender(
			<ArticleTocRail
				items={nextItems}
				activeId={items[12].id}
				active={false}
				readPercent={50}
			/>,
		);
		settle();
		expect(
			view.container.querySelector('[data-toc-rail-marker="section-12"]')?.getAttribute("cy"),
		).toBe("300");
		view.rerender(
			<ArticleTocRail items={nextItems} activeId={items[12].id} active readPercent={50} />,
		);
		settle();
		expect(
			view.container.querySelector('[data-toc-rail-marker="section-12"]')?.getAttribute("cx"),
		).not.toBe("8");
	});

	it("正文内容展开改变标题占比时移动轨迹节点，随后停止", () => {
		const body = document.createElement("article");
		const heading = document.createElement("h2");
		heading.id = items[1].id;
		let headingTop = 6500;
		vi.spyOn(heading, "getBoundingClientRect").mockImplementation(
			() => ({ top: headingTop }) as DOMRect,
		);
		body.append(heading);
		const view = render(
			<ArticleTocRail
				items={[items[0], items[1]]}
				activeId={items[1].id}
				active
				readPercent={50}
				contentRef={{ current: body }}
			/>,
		);
		view.container.append(body);
		resize();
		settle();
		const marker = view.container.querySelector('[data-toc-rail-marker="section-1"]');
		expect(marker?.getAttribute("cy")).toBe("200");
		headingTop = 9750;
		resize();
		settle();
		expect(marker?.getAttribute("cy")).toBe("300");
	});

	it("减少动态效果时立即落位，页面隐藏时暂停并在恢复可见后收敛", () => {
		preferences.reduced = true;
		const view = render(
			<ArticleTocRail items={items} activeId={items[0].id} active readPercent={50} />,
		);
		settle();
		expect(
			view.container.querySelector("[data-toc-rail-label]")?.getAttribute("style"),
		).toContain("200px");
		vi.spyOn(document, "hidden", "get").mockReturnValue(true);
		fireEvent(document, new Event("visibilitychange"));
		view.rerender(
			<ArticleTocRail items={items} activeId={items[0].id} active readPercent={80} />,
		);
		expect(frames.size).toBe(0);
		vi.spyOn(document, "hidden", "get").mockReturnValue(false);
		fireEvent(document, new Event("visibilitychange"));
		settle();
		expect(
			view.container.querySelector("[data-toc-rail-label]")?.getAttribute("style"),
		).toContain("320px");
	});
});
