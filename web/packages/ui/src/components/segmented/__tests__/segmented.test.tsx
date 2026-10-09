import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Segmented, type SegmentedItem } from "../segmented";

const base: SegmentedItem[] = [
	{ value: "a", label: "甲" },
	{ value: "b", label: "乙" },
	{ value: "c", label: "丙" },
];

const container = () =>
	document.querySelector<HTMLElement>('[data-slot="segmented"]') as HTMLElement;
const indicator = () =>
	container().querySelector<HTMLElement>(".v-segmented__indicator") as HTMLElement;
const focused = () => (document.activeElement as HTMLElement).textContent;

/** 只覆盖 offset* 读数，其余 HTMLElement 行为保持 jsdom 原样。 */
function mockOffsets(values: { left: number; width: number; top: number; height: number }) {
	const proto = HTMLElement.prototype;
	const entries = [
		["offsetLeft", values.left],
		["offsetWidth", values.width],
		["offsetTop", values.top],
		["offsetHeight", values.height],
	] as const;
	for (const [key, value] of entries) {
		vi.spyOn(proto, key, "get").mockReturnValue(value);
	}
}

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe("Segmented 默认按钮语义", () => {
	it("以 aria-pressed 表达选中，点击非禁用项触发 onValueChange", () => {
		const onValueChange = vi.fn();
		render(<Segmented value="a" onValueChange={onValueChange} segments={base} />);

		expect(screen.getByRole("button", { name: "甲" }).getAttribute("aria-pressed")).toBe(
			"true",
		);
		expect(screen.getByRole("button", { name: "乙" }).getAttribute("aria-pressed")).toBe(
			"false",
		);

		fireEvent.click(screen.getByRole("button", { name: "乙" }));
		expect(onValueChange).toHaveBeenCalledExactlyOnceWith("b");
	});

	it("禁用项与整体禁用都不触发回调", () => {
		const onValueChange = vi.fn();
		const { rerender } = render(
			<Segmented
				value="a"
				onValueChange={onValueChange}
				segments={[base[0] as SegmentedItem, { value: "b", label: "乙", disabled: true }]}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: "乙" }));
		expect(onValueChange).not.toHaveBeenCalled();

		rerender(<Segmented value="a" onValueChange={onValueChange} segments={base} disabled />);
		for (const button of screen.getAllByRole("button")) {
			expect((button as HTMLButtonElement).disabled).toBe(true);
			fireEvent.click(button);
		}
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it("onValueChange 可省略", () => {
		render(<Segmented value="a" segments={base} />);
		expect(() => fireEvent.click(screen.getByRole("button", { name: "乙" }))).not.toThrow();
	});

	it("值不匹配任何项时无选中且标记 data-has-active=false", () => {
		render(<Segmented value={"none"} segments={base} />);
		expect(container().dataset.hasActive).toBe("false");
		for (const button of screen.getAllByRole("button")) {
			expect(button.getAttribute("aria-pressed")).toBe("false");
		}
	});

	it("无 icon、无 itemSize 的项直接渲染 label，不包 label 容器", () => {
		render(<Segmented value="a" segments={base} />);
		expect(container().querySelector(".v-segmented__label")).toBeNull();
		expect(screen.getByRole("button", { name: "甲" }).textContent).toBe("甲");
	});

	it("等尺寸模式下激活项始终套用 activeItemClassName，其余项不套用", () => {
		render(<Segmented value="a" segments={base} itemSize="3rem" activeItemClassName="lit" />);
		expect(screen.getByRole("button", { name: "甲" }).className).toContain("lit");
		expect(screen.getByRole("button", { name: "乙" }).className).not.toContain("lit");
	});
});

describe("Segmented render 自定义元素", () => {
	it("使用 render 输出，保留链接属性并附带数据属性，点击仍触发回调", () => {
		const onValueChange = vi.fn();
		render(
			<Segmented
				value="b"
				onValueChange={onValueChange}
				segments={[
					{
						value: "a",
						label: "首页",
						render: (props, { active }) => (
							<a href="#home" {...props} aria-current={active ? "page" : undefined} />
						),
					},
					{
						value: "b",
						label: "文章",
						render: (props, { active }) => (
							<a
								href="#posts"
								{...props}
								aria-current={active ? "page" : undefined}
							/>
						),
					},
				]}
			/>,
		);

		const home = screen.getByRole("link", { name: "首页" });
		expect(home.getAttribute("href")).toBe("#home");
		expect(home.hasAttribute("data-segment-item")).toBe(true);
		expect(home.dataset.active).toBe("false");
		expect(home.hasAttribute("aria-pressed")).toBe(false);
		expect(screen.getByRole("link", { name: "文章" }).dataset.active).toBe("true");
		expect(screen.getByRole("link", { name: "文章" }).getAttribute("aria-current")).toBe(
			"page",
		);

		fireEvent.click(home);
		expect(onValueChange).toHaveBeenCalledExactlyOnceWith("a");
	});

	it("禁用的 render 项不触发回调并带禁用标记", () => {
		const onValueChange = vi.fn();
		render(
			<Segmented
				value="a"
				onValueChange={onValueChange}
				segments={[
					{ value: "a", label: "甲" },
					{
						value: "b",
						label: "乙",
						disabled: true,
						render: (props) => <a href="#b" {...props} />,
					},
				]}
			/>,
		);
		const link = screen.getByRole("link", { name: "乙" });
		expect(link.getAttribute("aria-disabled")).toBe("true");
		expect(link.hasAttribute("data-disabled")).toBe(true);
		fireEvent.click(link);
		expect(onValueChange).not.toHaveBeenCalled();
	});
});

describe("Segmented 等尺寸布局", () => {
	it("写入布局标记与 CSS 变量，索引变量跟随 value", () => {
		const { rerender } = render(<Segmented value="b" segments={base} itemSize="3rem" />);
		const el = container();
		expect(el.dataset.layout).toBe("equal");
		expect(el.style.getPropertyValue("--v-segmented-item-size")).toBe("3rem");
		expect(el.style.getPropertyValue("--v-segmented-collapsed-size")).toBe("2.25rem");
		expect(el.style.getPropertyValue("--v-segmented-count")).toBe("3");
		expect(el.style.getPropertyValue("--v-segmented-index")).toBe("1");
		expect(el.dataset.hasActive).toBe("true");

		rerender(<Segmented value="c" segments={base} itemSize="3rem" />);
		expect(container().style.getPropertyValue("--v-segmented-index")).toBe("2");

		rerender(<Segmented value={"none"} segments={base} itemSize="3rem" />);
		expect(container().dataset.hasActive).toBe("false");
		expect(container().style.getPropertyValue("--v-segmented-index")).toBe("0");
	});

	it("weight 让项按 itemSize 的倍数加宽，位移与总量变量按权重累计", () => {
		const weighted = [base[0], { ...base[1], weight: 1.5 }, base[2]];
		const { rerender } = render(<Segmented value="c" segments={weighted} itemSize="3rem" />);
		const el = container();
		expect(el.style.getPropertyValue("--v-segmented-total")).toBe("3.5");
		expect(el.style.getPropertyValue("--v-segmented-offset")).toBe("2.5");
		expect(el.style.getPropertyValue("--v-segmented-active-weight")).toBe("1");
		expect(
			screen
				.getByRole("button", { name: "乙" })
				.style.getPropertyValue("--v-segmented-weight"),
		).toBe("1.5");
		expect(
			screen
				.getByRole("button", { name: "甲" })
				.style.getPropertyValue("--v-segmented-weight"),
		).toBe("");

		rerender(<Segmented value="b" segments={weighted} itemSize="3rem" />);
		expect(container().style.getPropertyValue("--v-segmented-offset")).toBe("1");
		expect(container().style.getPropertyValue("--v-segmented-active-weight")).toBe("1.5");
	});

	it("合并使用方 style，且等尺寸模式的项始终使用激活样式", () => {
		render(
			<Segmented
				value="a"
				segments={base}
				itemSize="3rem"
				style={{ marginTop: 4 }}
				activeItemClassName="lit"
			/>,
		);
		expect(container().style.marginTop).toBe("4px");
		expect(screen.getByRole("button", { name: "甲" }).className).toContain("lit");
		expect(container().dataset.measured).toBeUndefined();
	});

	it("expandSelected 标记展开，未选中项仍保留图标与 label 容器", () => {
		render(
			<Segmented
				value="b"
				itemSize="3rem"
				expandSelected
				segments={[
					{ value: "a", label: "甲", icon: <svg data-testid="icon-a" /> },
					{ value: "b", label: "乙", icon: <svg data-testid="icon-b" /> },
				]}
			/>,
		);
		expect(container().dataset.expanded).toBe("true");
		const inactive = screen.getByRole("button", { name: "甲" });
		expect(inactive.querySelector('[data-testid="icon-a"]')).not.toBeNull();
		expect(inactive.querySelector(".v-segmented__label")?.textContent).toBe("甲");
	});

	it("expandSelected 为 false 时标记收起；缺少 itemSize 时不生效", () => {
		const { rerender } = render(
			<Segmented value="a" segments={base} itemSize="3rem" expandSelected={false} />,
		);
		expect(container().dataset.expanded).toBe("false");

		rerender(<Segmented value="a" segments={base} expandSelected />);
		expect(container().dataset.expanded).toBeUndefined();
	});

	it("icon、trailing 渲染为独立部件，仅图标的项带 data-icon-only", () => {
		render(
			<Segmented
				value="a"
				segments={[
					{ value: "a", label: "甲", icon: <svg />, trailing: <i data-testid="chev" /> },
					{ value: "b", label: "", icon: <svg /> },
				]}
			/>,
		);
		const full = screen.getAllByRole("button")[0] as HTMLElement;
		expect(full.querySelector(".v-segmented__trailing [data-testid='chev']")).not.toBeNull();
		expect(full.hasAttribute("data-icon-only")).toBe(false);
		const iconOnly = screen.getAllByRole("button")[1] as HTMLElement;
		expect(iconOnly.hasAttribute("data-icon-only")).toBe(true);
		expect(iconOnly.querySelector(".v-segmented__label")).toBeNull();
	});

	it("服务端渲染直接带出变量与指示器", () => {
		const html = renderToString(<Segmented value="b" segments={base} itemSize="3rem" />);
		expect(html).toContain("--v-segmented-item-size:3rem");
		expect(html).toContain("--v-segmented-index:1");
		expect(html).toContain('data-layout="equal"');
		expect(html).toContain("v-segmented__indicator");
	});
});

describe("Segmented 变体与方向", () => {
	it("variant、orientation、size 等写成数据属性", () => {
		render(
			<Segmented
				value="a"
				segments={base}
				variant="ink"
				orientation="vertical"
				size="lg"
				rounded="full"
				block
			/>,
		);
		const el = container();
		expect(el.dataset.variant).toBe("ink");
		expect(el.dataset.orientation).toBe("vertical");
		expect(el.dataset.size).toBe("lg");
		expect(el.dataset.rounded).toBe("full");
		expect(el.dataset.block).toBe("true");
	});

	it("默认值为 soft、horizontal、sm", () => {
		render(<Segmented value="a" segments={base} />);
		expect(container().dataset.variant).toBe("soft");
		expect(container().dataset.orientation).toBe("horizontal");
		expect(container().dataset.size).toBe("sm");
	});
});

describe("Segmented 键盘导航", () => {
	const items: SegmentedItem[] = [
		{ value: "a", label: "甲" },
		{ value: "b", label: "乙", disabled: true },
		{ value: "c", label: "丙" },
		{ value: "d", label: "丁" },
	];
	const press = (key: string) =>
		fireEvent.keyDown(document.activeElement as HTMLElement, { key });
	const focusItem = (name: string) => act(() => screen.getByRole("button", { name }).focus());

	it("横向用左右键移动焦点，跳过禁用项并循环，且不改变选中值", () => {
		const onValueChange = vi.fn();
		render(<Segmented value="a" onValueChange={onValueChange} segments={items} />);

		focusItem("甲");
		press("ArrowRight");
		expect(focused()).toBe("丙");
		press("ArrowRight");
		expect(focused()).toBe("丁");
		press("ArrowRight");
		expect(focused()).toBe("甲");
		press("ArrowLeft");
		expect(focused()).toBe("丁");
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it("横向忽略上下键，竖向忽略左右键", () => {
		const { rerender } = render(<Segmented value="a" segments={items} />);
		focusItem("甲");
		expect(fireEvent.keyDown(document.activeElement as HTMLElement, { key: "ArrowDown" })).toBe(
			true,
		);
		expect(focused()).toBe("甲");

		rerender(<Segmented value="a" segments={items} orientation="vertical" />);
		focusItem("甲");
		expect(
			fireEvent.keyDown(document.activeElement as HTMLElement, { key: "ArrowRight" }),
		).toBe(true);
		expect(focused()).toBe("甲");
		press("ArrowDown");
		expect(focused()).toBe("丙");
		press("ArrowUp");
		expect(focused()).toBe("甲");
	});

	it("Home 与 End 跳到首个与末个启用项", () => {
		render(<Segmented value="a" segments={items} orientation="vertical" />);
		focusItem("丙");
		press("End");
		expect(focused()).toBe("丁");
		press("Home");
		expect(focused()).toBe("甲");
	});

	it("仅在处理时 preventDefault，并尊重已取消的事件", () => {
		render(<Segmented value="a" segments={items} />);
		focusItem("甲");
		expect(
			fireEvent.keyDown(document.activeElement as HTMLElement, { key: "ArrowRight" }),
		).toBe(false);
		expect(fireEvent.keyDown(document.activeElement as HTMLElement, { key: "a" })).toBe(true);

		const onKeyDownCapture = (event: Event) => event.preventDefault();
		document.addEventListener("keydown", onKeyDownCapture, true);
		focusItem("甲");
		press("ArrowRight");
		document.removeEventListener("keydown", onKeyDownCapture, true);
		expect(focused()).toBe("甲");
	});

	it("对 render 出的链接同样生效", () => {
		render(
			<Segmented
				value="a"
				segments={["a", "b", "c"].map((value) => ({
					value,
					label: value.toUpperCase(),
					render: (props) => <a href={`#${value}`} {...props} />,
				}))}
			/>,
		);
		act(() => screen.getByRole("link", { name: "A" }).focus());
		press("ArrowRight");
		expect(focused()).toBe("B");
		press("End");
		expect(focused()).toBe("C");
	});

	it("不改变 tab 停靠点", () => {
		render(<Segmented value="a" segments={items} />);
		for (const button of screen.getAllByRole("button")) {
			expect(button.hasAttribute("tabindex")).toBe(false);
		}
	});
});

describe("Segmented 测量模式", () => {
	it("横向用 translate3d 的 X 位移与 width 定位指示器", () => {
		mockOffsets({ left: 40, width: 80, top: 10, height: 30 });
		render(<Segmented value="b" segments={base} />);

		expect(indicator().style.transform).toBe("translate3d(40px, 0, 0)");
		expect(indicator().style.width).toBe("80px");
		expect(indicator().style.left).toBe("");
		expect(container().dataset.measured).toBe("true");
	});

	it("竖向用 Y 位移与 height", () => {
		mockOffsets({ left: 40, width: 80, top: 10, height: 30 });
		render(<Segmented value="b" segments={base} orientation="vertical" />);

		expect(indicator().style.transform).toBe("translate3d(0, 10px, 0)");
		expect(indicator().style.height).toBe("30px");
	});

	it("首次定位前指示器未测量、激活项自含底色；定位后才允许滑动过渡", () => {
		vi.useFakeTimers();
		try {
			const html = renderToString(<Segmented value="a" segments={base} />);
			expect(html).toContain('data-measured="false"');
			expect(html).not.toContain("translate3d");

			mockOffsets({ left: 4, width: 20, top: 0, height: 0 });
			render(<Segmented value="a" segments={base} />);
			expect(container().dataset.animated).toBeUndefined();
			act(() => {
				vi.advanceTimersByTime(100);
			});
			expect(container().dataset.animated).toBe("true");
		} finally {
			vi.useRealTimers();
		}
	});

	it("测量模式下激活项套用 activeItemClassName", () => {
		mockOffsets({ left: 0, width: 20, top: 0, height: 0 });
		render(<Segmented value="a" segments={base} activeItemClassName="lit" />);
		expect(screen.getByRole("button", { name: "甲" }).className).toContain("lit");
	});

	it("无选中项时不测量", () => {
		mockOffsets({ left: 40, width: 80, top: 0, height: 0 });
		render(<Segmented value={"none"} segments={base} />);
		expect(indicator().style.transform).toBe("");
		expect(container().dataset.measured).toBe("false");
	});
});
