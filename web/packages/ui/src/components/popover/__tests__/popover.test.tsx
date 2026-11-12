import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "../../button";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";

function Filter({
	name = "标签",
	...props
}: { name?: string } & Partial<Parameters<typeof Popover>[0]>) {
	return (
		<Popover {...props}>
			<PopoverTrigger asChild>
				<button type="button">{name}</button>
			</PopoverTrigger>
			<PopoverContent>
				<input aria-label={`${name}搜索`} />
				<button type="button">清除</button>
			</PopoverContent>
		</Popover>
	);
}

const trigger = (name = "标签") => screen.getByRole("button", { name });
const panel = () => screen.queryByRole("dialog");
const open = (name?: string) => fireEvent.click(trigger(name));
/** Radix 在宏任务里才登记外部按下监听。 */
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
const pressOutside = async () => {
	await settle();
	fireEvent.pointerDown(document.body, { pointerType: "mouse", button: 0 });
	fireEvent.pointerUp(document.body, { pointerType: "mouse", button: 0 });
	fireEvent.click(document.body);
};

/** IntersectionObserver 的可控替身：测试用 `reveal` 推送触发器是否仍在视野内。 */
function stubIntersectionObserver() {
	const observers = new Set<{
		callback: IntersectionObserverCallback;
		targets: Set<Element>;
	}>();
	class FakeObserver {
		private readonly entry: { callback: IntersectionObserverCallback; targets: Set<Element> };
		constructor(callback: IntersectionObserverCallback) {
			this.entry = { callback, targets: new Set() };
			observers.add(this.entry);
		}
		observe = (target: Element) => void this.entry.targets.add(target);
		unobserve = (target: Element) => void this.entry.targets.delete(target);
		disconnect = () => void observers.delete(this.entry);
	}
	vi.stubGlobal("IntersectionObserver", FakeObserver);
	return {
		count: () => observers.size,
		reveal(target: Element, isIntersecting: boolean) {
			act(() => {
				for (const { callback, targets } of observers) {
					if (targets.has(target)) {
						callback(
							[{ target, isIntersecting } as IntersectionObserverEntry],
							{} as IntersectionObserver,
						);
					}
				}
			});
		},
	};
}

describe("Popover", () => {
	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
	});

	it("点触发器打开，再点一次关闭，焦点回到触发器", async () => {
		render(<Filter />);
		expect(panel()).toBeNull();

		open();
		expect(panel()).not.toBeNull();
		fireEvent.click(trigger());
		await waitFor(() => expect(panel()).toBeNull());
		await waitFor(() => expect(document.activeElement).toBe(trigger()));
	});

	it("打开后焦点进入面板的第一个控件", async () => {
		render(<Filter />);
		open();
		await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("标签搜索")));
	});

	it("点击面板外面关闭，焦点回到触发器", async () => {
		render(<Filter />);
		open();
		await pressOutside();
		await waitFor(() => expect(panel()).toBeNull());
		await waitFor(() => expect(document.activeElement).toBe(trigger()));
	});

	it("点到别的可聚焦元素时，焦点留在那里", async () => {
		render(
			<>
				<Filter />
				<button type="button">其他</button>
			</>,
		);
		open();
		await settle();
		const other = screen.getByRole("button", { name: "其他" });
		fireEvent.pointerDown(other, { pointerType: "mouse", button: 0 });
		act(() => other.focus());
		fireEvent.pointerUp(other, { pointerType: "mouse", button: 0 });
		fireEvent.click(other);
		await waitFor(() => expect(panel()).toBeNull());
		expect(document.activeElement).toBe(other);
	});

	it("Esc 关闭，焦点回到触发器", async () => {
		render(<Filter />);
		open();
		await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("标签搜索")));
		fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
		await waitFor(() => expect(panel()).toBeNull());
		await waitFor(() => expect(document.activeElement).toBe(trigger()));
	});

	it("非模态：没有遮罩，背后的内容保持可交互", () => {
		render(
			<>
				<Filter />
				<button type="button">背景按钮</button>
			</>,
		);
		open();
		expect(document.body.style.pointerEvents).not.toBe("none");
		expect(
			screen.getByRole("button", { name: "背景按钮" }).closest("[aria-hidden]"),
		).toBeNull();
	});

	it("触发器带 aria-haspopup 与 aria-expanded，面板是 dialog 并以触发器命名", () => {
		render(<Filter />);
		expect(trigger().getAttribute("aria-haspopup")).toBe("dialog");
		expect(trigger().getAttribute("aria-expanded")).toBe("false");

		open();
		expect(trigger().getAttribute("aria-expanded")).toBe("true");
		expect(screen.getByRole("dialog", { name: "标签" })).not.toBeNull();
	});

	it("调用方显式给了名字时，不再用触发器命名", () => {
		render(
			<Popover>
				<PopoverTrigger asChild>
					<button type="button">添加表情</button>
				</PopoverTrigger>
				<PopoverContent aria-label="表情选择器">
					<button type="button">微笑</button>
				</PopoverContent>
			</Popover>,
		);
		open("添加表情");
		expect(screen.getByRole("dialog", { name: "表情选择器" })).not.toBeNull();
	});

	it("触发器是 Button 时，打开期间带 aria-expanded 供按下态样式使用", () => {
		render(
			<Popover>
				<PopoverTrigger asChild>
					<Button variant="outline">显示</Button>
				</PopoverTrigger>
				<PopoverContent>内容</PopoverContent>
			</Popover>,
		);
		const button = screen.getByRole("button", { name: "显示" });
		open("显示");
		expect(button.getAttribute("aria-expanded")).toBe("true");
		expect(button.getAttribute("data-state")).toBe("open");
		expect(button.className).toContain("v-button--outline");
	});

	it("同时只开一个：打开另一个时前一个收起", async () => {
		render(
			<>
				<Filter name="标签" />
				<Filter name="分享" />
			</>,
		);
		open("标签");
		expect(screen.getAllByRole("dialog")).toHaveLength(1);
		await settle();

		fireEvent.pointerDown(trigger("分享"), { pointerType: "mouse", button: 0 });
		fireEvent.click(trigger("分享"));
		await waitFor(() => expect(screen.getByRole("dialog", { name: "分享" })).not.toBeNull());
		expect(screen.getAllByRole("dialog")).toHaveLength(1);
		expect(trigger("标签").getAttribute("aria-expanded")).toBe("false");
	});

	it("触发器滚出视野时自动关闭，并停止观察", () => {
		const io = stubIntersectionObserver();
		render(<Filter />);
		open();
		expect(io.count()).toBe(1);

		io.reveal(trigger(), true);
		expect(panel()).not.toBeNull();

		io.reveal(trigger(), false);
		expect(panel()).toBeNull();
		expect(trigger().getAttribute("aria-expanded")).toBe("false");
		expect(io.count()).toBe(0);
	});

	it("受控时滚出视野通过 onOpenChange(false) 通知", () => {
		const io = stubIntersectionObserver();
		const onOpenChange = vi.fn();
		render(<Filter open onOpenChange={onOpenChange} />);

		io.reveal(trigger(), false);
		expect(onOpenChange).toHaveBeenCalledWith(false);
		expect(panel()).not.toBeNull();
	});

	it("container 把面板挂到指定容器", () => {
		const host = document.createElement("div");
		document.body.append(host);
		render(
			<Popover defaultOpen>
				<PopoverTrigger>开</PopoverTrigger>
				<PopoverContent container={host}>内容</PopoverContent>
			</Popover>,
		);
		expect(host.contains(screen.getByRole("dialog"))).toBe(true);
		host.remove();
	});

	it("className 追加到外壳类名之后，不替换", () => {
		render(
			<Popover defaultOpen>
				<PopoverTrigger>开</PopoverTrigger>
				<PopoverContent className="w-44">内容</PopoverContent>
			</Popover>,
		);
		const content = screen.getByRole("dialog");
		expect(content.classList.contains("v-popover")).toBe(true);
		expect(content.classList.contains("w-44")).toBe(true);
	});
});
