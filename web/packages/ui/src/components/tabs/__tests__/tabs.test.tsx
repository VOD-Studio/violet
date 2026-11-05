import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Tabs, TabsContent, TabsCount, TabsList, TabsTrigger } from "../tabs";

/** 三个平级分区的基础用法。 */
function Fixture({
	value,
	defaultValue,
	onValueChange,
	orientation,
	forceMountSecond,
	disableSecond,
}: {
	value?: string;
	defaultValue?: string;
	onValueChange?: (value: string) => void;
	orientation?: "horizontal" | "vertical";
	forceMountSecond?: boolean;
	disableSecond?: boolean;
}) {
	return (
		<Tabs
			value={value}
			defaultValue={defaultValue}
			onValueChange={onValueChange}
			orientation={orientation}
		>
			<TabsList>
				<TabsTrigger value="articles">文章</TabsTrigger>
				<TabsTrigger value="comments" disabled={disableSecond}>
					评论
				</TabsTrigger>
				<TabsTrigger value="reactions">回应</TabsTrigger>
			</TabsList>
			<TabsContent value="articles">
				<p>文章面板</p>
			</TabsContent>
			<TabsContent value="comments" forceMount={forceMountSecond ? true : undefined}>
				<p>评论面板</p>
			</TabsContent>
			<TabsContent value="reactions">
				<p>回应面板</p>
			</TabsContent>
		</Tabs>
	);
}

const tablist = () => screen.getByRole("tablist");
const tab = (name: string) => screen.getByRole("tab", { name });
const indicator = () => tablist().querySelector<HTMLElement>(".v-tabs__indicator") as HTMLElement;
const listWrap = () => tablist().parentElement as HTMLElement;
const activePanelId = () => screen.getByRole("tabpanel").getAttribute("aria-labelledby");

/** 只覆盖几何/滚动读数，其余 HTMLElement 行为保持 jsdom 原样。 */
function mockMetrics(values: {
	left?: number;
	width?: number;
	top?: number;
	height?: number;
	scrollWidth?: number;
	clientWidth?: number;
	scrollLeft?: number;
}) {
	const proto = HTMLElement.prototype;
	type MetricKey =
		| "offsetLeft"
		| "offsetWidth"
		| "offsetTop"
		| "offsetHeight"
		| "scrollWidth"
		| "clientWidth"
		| "scrollLeft";
	const entries: [MetricKey, number | undefined][] = [
		["offsetLeft", values.left],
		["offsetWidth", values.width],
		["offsetTop", values.top],
		["offsetHeight", values.height],
		["scrollWidth", values.scrollWidth],
		["clientWidth", values.clientWidth],
		["scrollLeft", values.scrollLeft],
	];
	for (const [key, value] of entries) {
		if (value !== undefined) vi.spyOn(proto, key, "get").mockReturnValue(value);
	}
}

/** MutationObserver 在微任务里送达。 */
const flushMutations = async () => {
	await act(async () => {
		await Promise.resolve();
	});
};

/** Radix 把方向键的焦点移动推迟到 setTimeout 里执行。 */
const press = async (key: string, target: HTMLElement) => {
	const notPrevented = fireEvent.keyDown(target, { key });
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0));
	});
	return notPrevented;
};

const focusTab = (name: string) => act(() => tab(name).focus());

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe("Tabs 语义与连线", () => {
	it("渲染 tablist / tab / tabpanel，aria-selected 与 aria-controls 互相对应", () => {
		render(<Fixture defaultValue="articles" />);
		const tabs = screen.getAllByRole("tab");
		expect(tabs).toHaveLength(3);
		expect(tab("文章").getAttribute("aria-selected")).toBe("true");
		expect(tab("评论").getAttribute("aria-selected")).toBe("false");

		const panel = screen.getByRole("tabpanel", { name: "文章" });
		expect(panel.tagName).toBe("DIV");
		expect(tab("文章").getAttribute("aria-controls")).toBe(panel.id);
		expect(panel.getAttribute("aria-labelledby")).toBe(tab("文章").id);
		expect(activePanelId()).toBe(tab("文章").id);
	});

	it("未用 forceMount 的面板不挂载，激活面板可聚焦（tabindex=0）", () => {
		render(<Fixture defaultValue="articles" />);
		expect(screen.queryByRole("tabpanel", { name: "评论", hidden: true })).toBeNull();
		expect(screen.getByRole("tabpanel", { name: "文章" }).tabIndex).toBe(0);
	});

	it("forceMount 的未激活面板留在 DOM 但被隐藏", () => {
		render(<Fixture defaultValue="articles" forceMountSecond />);
		const inactive = tablist().parentElement?.parentElement?.querySelector(
			'[data-slot="tabs-panel"][data-state="inactive"]',
		);
		expect(inactive).not.toBeNull();
		expect(inactive?.textContent).toContain("评论面板");
		expect(inactive?.getAttribute("aria-labelledby")).toBe(tab("评论").id);
		expect((inactive as HTMLElement).hidden).toBe(true);
		// 隐藏的面板不进入可访问树
		expect(screen.queryByRole("tabpanel", { name: "评论" })).toBeNull();
	});

	it("TabsCount 是标签可读名称的一部分，且不对读屏隐藏", () => {
		render(
			<Tabs defaultValue="comments">
				<TabsList>
					<TabsTrigger value="articles">文章</TabsTrigger>
					<TabsTrigger value="comments">
						评论
						<TabsCount>12</TabsCount>
					</TabsTrigger>
				</TabsList>
				<TabsContent value="articles">a</TabsContent>
				<TabsContent value="comments">b</TabsContent>
			</Tabs>,
		);
		// 可访问名称按内容拼接为「评论12」，可见间距由 CSS 提供
		const named = screen.getByRole("tab", { name: "评论12" });
		const count = named.querySelector('[data-slot="tabs-count"]');
		expect(count?.textContent).toBe("12");
		expect(count?.getAttribute("aria-hidden")).toBeNull();
	});

	it("底线指示器与两端渐隐对读屏隐藏", () => {
		render(<Fixture defaultValue="articles" />);
		expect(indicator().getAttribute("aria-hidden")).toBe("true");
		const fades = listWrap().querySelectorAll(".v-tabs__fade");
		expect(fades).toHaveLength(2);
		for (const fade of fades) expect(fade.getAttribute("aria-hidden")).toBe("true");
	});
});

describe("Tabs 键盘与激活", () => {
	it("→ 移动焦点并立即激活，← 再移回", async () => {
		render(<Fixture defaultValue="articles" />);
		await focusTab("文章");
		await press("ArrowRight", tab("文章"));
		expect(document.activeElement).toBe(tab("评论"));
		expect(activePanelId()).toBe(tab("评论").id);
		expect(screen.getByRole("tabpanel", { name: "评论" }).textContent).toContain("评论面板");

		await press("ArrowLeft", tab("评论"));
		expect(document.activeElement).toBe(tab("文章"));
		expect(activePanelId()).toBe(tab("文章").id);
	});

	it("Home / End 跳到首尾并激活", async () => {
		render(<Fixture defaultValue="reactions" />);
		await focusTab("回应");
		await press("Home", tab("回应"));
		expect(document.activeElement).toBe(tab("文章"));
		expect(activePanelId()).toBe(tab("文章").id);

		await press("End", tab("文章"));
		expect(document.activeElement).toBe(tab("回应"));
		expect(activePanelId()).toBe(tab("回应").id);
	});

	it("禁用标签被跳过且不激活", async () => {
		render(<Fixture defaultValue="articles" disableSecond />);
		const disabled = tab("评论");
		expect((disabled as HTMLButtonElement).disabled).toBe(true);
		expect(disabled.hasAttribute("data-disabled")).toBe(true);

		await focusTab("文章");
		await press("ArrowRight", tab("文章"));
		expect(document.activeElement).toBe(tab("回应"));
		expect(activePanelId()).toBe(tab("回应").id);
	});

	it("竖排用 ↑↓ 移动激活，←→ 不接管", async () => {
		render(<Fixture defaultValue="articles" orientation="vertical" />);
		await focusTab("文章");
		expect(await press("ArrowRight", tab("文章"))).toBe(true);
		expect(document.activeElement).toBe(tab("文章"));

		await press("ArrowDown", tab("文章"));
		expect(document.activeElement).toBe(tab("评论"));
		expect(activePanelId()).toBe(tab("评论").id);

		await press("ArrowUp", tab("评论"));
		expect(document.activeElement).toBe(tab("文章"));
		expect(activePanelId()).toBe(tab("文章").id);
	});
});

describe("Tabs 受控与非受控", () => {
	it("非受控：点击另一枚标签切换面板", () => {
		render(<Fixture defaultValue="articles" />);
		fireEvent.mouseDown(tab("回应"));
		expect(activePanelId()).toBe(tab("回应").id);
	});

	it("受控：onValueChange 收到新值，外部不更新时面板保持", () => {
		const onValueChange = vi.fn();
		render(<Fixture value="articles" onValueChange={onValueChange} />);
		fireEvent.mouseDown(tab("回应"));
		expect(onValueChange).toHaveBeenCalledExactlyOnceWith("reactions");
		expect(activePanelId()).toBe(tab("文章").id);
	});
});

describe("Tabs 底线测量与滚动", () => {
	it("横向测量写入起点与宽度变量，竖向写入高度", async () => {
		mockMetrics({ left: 40, width: 80, top: 12, height: 36 });
		const { rerender } = render(<Fixture defaultValue="comments" />);
		expect(indicator().style.getPropertyValue("--v-tabs-indicator-offset")).toBe("40px");
		expect(indicator().style.getPropertyValue("--v-tabs-indicator-size")).toBe("80px");

		rerender(<Fixture defaultValue="comments" orientation="vertical" />);
		await flushMutations();
		expect(indicator().style.getPropertyValue("--v-tabs-indicator-offset")).toBe("12px");
		expect(indicator().style.getPropertyValue("--v-tabs-indicator-size")).toBe("36px");
	});

	it("首次定位后才标记 data-animated，避免从第一项滑进来", async () => {
		mockMetrics({ left: 0, width: 28 });
		render(<Fixture defaultValue="articles" />);
		expect(tablist().hasAttribute("data-animated")).toBe(false);
		await act(async () => {
			const promise = new Promise<void>((resolve) => {
				requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
			});
			await promise;
		});
		expect(tablist().hasAttribute("data-animated")).toBe(true);
	});

	it("当前标签变化时滚入可见区，初次渲染不滚动", async () => {
		const receivers: string[] = [];
		vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(function (this: Element) {
			receivers.push(`${this.textContent} @ ${(this as HTMLElement).dataset.state}`);
		});
		render(<Fixture defaultValue="articles" />);
		await flushMutations();
		expect(receivers, receivers.join(",")).toEqual([]);

		fireEvent.mouseDown(tab("回应"));
		await flushMutations();
		expect(receivers, receivers.join(",")).toEqual(["回应 @ active"]);
	});

	it("溢出标记跟随滚动位置，消费方 onScroll 仍然触发", () => {
		mockMetrics({ scrollWidth: 600, clientWidth: 300, scrollLeft: 0 });
		const onScroll = vi.fn();
		render(
			<Tabs defaultValue="articles">
				<TabsList onScroll={onScroll}>
					<TabsTrigger value="articles">文章</TabsTrigger>
				</TabsList>
				<TabsContent value="articles">a</TabsContent>
			</Tabs>,
		);
		expect(listWrap().hasAttribute("data-overflow-end")).toBe(true);
		expect(listWrap().hasAttribute("data-overflow-start")).toBe(false);

		vi.spyOn(HTMLElement.prototype, "scrollLeft", "get").mockReturnValue(600);
		fireEvent.scroll(tablist());
		expect(onScroll).toHaveBeenCalledOnce();
		expect(listWrap().hasAttribute("data-overflow-start")).toBe(true);
		expect(listWrap().hasAttribute("data-overflow-end")).toBe(false);
	});
});

describe("Tabs 透传与服务端渲染", () => {
	it("ref 与 className 落在各自的真实节点上，size 写成数据属性", () => {
		const rootRef = createRef<HTMLDivElement>();
		const listRef = createRef<HTMLDivElement>();
		const triggerRef = createRef<HTMLButtonElement>();
		const panelRef = createRef<HTMLDivElement>();

		render(
			<Tabs ref={rootRef} defaultValue="articles" data-testid="root">
				<TabsList ref={listRef} size="lg" className="consumer-list">
					<TabsTrigger ref={triggerRef} value="articles" className="consumer-tab">
						文章
					</TabsTrigger>
				</TabsList>
				<TabsContent ref={panelRef} value="articles" className="consumer-panel">
					<p>面板</p>
				</TabsContent>
			</Tabs>,
		);

		expect(rootRef.current?.getAttribute("data-testid")).toBe("root");
		expect(listRef.current).toBe(tablist());
		expect(listRef.current?.className).toContain("v-tabs__list");
		expect(listRef.current?.className).toContain("consumer-list");
		expect(listRef.current?.getAttribute("data-size")).toBe("lg");
		expect(triggerRef.current).toBe(tab("文章"));
		expect(triggerRef.current?.className).toContain("v-tabs__tab");
		expect(triggerRef.current?.className).toContain("consumer-tab");
		expect(panelRef.current).toBe(screen.getByRole("tabpanel", { name: "文章" }));
		expect(panelRef.current?.className).toContain("consumer-panel");
	});

	it("SSR 渲染不抛错，不输出底线位置，也不带动画标记", () => {
		const html = renderToString(
			<Tabs defaultValue="articles">
				<TabsList>
					<TabsTrigger value="articles">文章</TabsTrigger>
				</TabsList>
				<TabsContent value="articles">面板</TabsContent>
			</Tabs>,
		);
		expect(html).toContain("v-tabs__indicator");
		expect(html).toContain('role="tabpanel"');
		expect(html).not.toContain("--v-tabs-indicator-offset");
		expect(html).not.toContain("data-animated");
	});
});
