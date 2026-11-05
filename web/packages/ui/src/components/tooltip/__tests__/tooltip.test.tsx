import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../tooltip";

function Toolbar({ children }: { children?: ReactNode }) {
	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger>粗体</TooltipTrigger>
				<TooltipContent shortcut={["mod", "B"]}>加粗</TooltipContent>
			</Tooltip>
			<Tooltip>
				<TooltipTrigger>斜体</TooltipTrigger>
				<TooltipContent>倾斜</TooltipContent>
			</Tooltip>
			{children}
		</TooltipProvider>
	);
}

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const hover = (element: Element) => {
	fireEvent.pointerMove(element, { pointerType: "mouse" });
	advance(0);
};
const unhover = (element: Element) => fireEvent.pointerLeave(element, { pointerType: "mouse" });
const bubble = () => document.querySelector<HTMLElement>("[data-slot='tooltip-content']");
const trigger = (name: string) => screen.getByRole("button", { name });

describe("Tooltip", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => {
		cleanup();
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("悬停立即出现，role=tooltip 并由触发器 aria-describedby 指向", () => {
		render(<Toolbar />);
		expect(screen.queryByRole("tooltip")).toBeNull();
		hover(trigger("粗体"));
		const tip = screen.getByRole("tooltip");
		expect(tip.textContent).toContain("加粗");
		expect(trigger("粗体").getAttribute("aria-describedby")).toBe(tip.id);
	});

	it("触屏不出现", () => {
		render(<Toolbar />);
		fireEvent.pointerMove(trigger("粗体"), { pointerType: "touch" });
		advance(10);
		expect(bubble()).toBeNull();
	});

	it("指针离开后等 60ms 才开始退回，等待内回到触发器就不收起", () => {
		render(<Toolbar />);
		hover(trigger("粗体"));
		unhover(trigger("粗体"));
		advance(59);
		expect(bubble()).not.toBeNull();
		expect(bubble()?.getAttribute("data-state")).not.toBe("closed");

		fireEvent.pointerMove(trigger("粗体"), { pointerType: "mouse" });
		advance(200);
		expect(bubble()).not.toBeNull();

		unhover(trigger("粗体"));
		advance(60);
		expect(bubble()).toBeNull();
	});

	it("按下触发器立即收起", () => {
		render(<Toolbar />);
		hover(trigger("粗体"));
		fireEvent.pointerDown(trigger("粗体"), { pointerType: "mouse" });
		expect(bubble()).toBeNull();
	});

	it("Esc 立即收起", () => {
		render(<Toolbar />);
		hover(trigger("粗体"));
		fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
		expect(bubble()).toBeNull();
	});

	it("键盘聚焦立即出现，失焦立即收起", () => {
		render(<Toolbar />);
		act(() => trigger("粗体").focus());
		expect(bubble()).not.toBeNull();
		act(() => trigger("粗体").blur());
		expect(bubble()).toBeNull();
	});

	it("整页同时只显示一个提示", () => {
		render(<Toolbar />);
		hover(trigger("粗体"));
		hover(trigger("斜体"));
		expect(screen.getAllByRole("tooltip")).toHaveLength(1);
		expect(screen.getByRole("tooltip").textContent).toContain("倾斜");
	});

	it("默认带箭头，arrow={false} 去掉", () => {
		const first = render(<Toolbar />);
		hover(trigger("粗体"));
		expect(bubble()?.querySelector(".v-tooltip__arrow")).not.toBeNull();
		first.unmount();
		render(
			<TooltipProvider>
				<Tooltip defaultOpen>
					<TooltipTrigger>无箭头</TooltipTrigger>
					<TooltipContent arrow={false}>提示</TooltipContent>
				</Tooltip>
			</TooltipProvider>,
		);
		expect(bubble()).not.toBeNull();
		expect(bubble()?.querySelector(".v-tooltip__arrow")).toBeNull();
	});

	it("快捷键一个组合一个键帽", () => {
		render(<Toolbar />);
		hover(trigger("粗体"));
		expect(bubble()?.querySelectorAll(":scope > kbd")).toHaveLength(1);
	});

	it("container 把气泡挂进指定容器", () => {
		const host = document.createElement("div");
		document.body.append(host);
		render(
			<TooltipProvider>
				<Tooltip defaultOpen>
					<TooltipTrigger>触发</TooltipTrigger>
					<TooltipContent container={host}>提示</TooltipContent>
				</Tooltip>
			</TooltipProvider>,
		);
		expect(host.contains(bubble())).toBe(true);
		host.remove();
	});

	describe("truncatedOnly", () => {
		const metrics = (element: HTMLElement, scrollWidth: number, clientWidth: number) => {
			Object.defineProperty(element, "scrollWidth", {
				configurable: true,
				value: scrollWidth,
			});
			Object.defineProperty(element, "clientWidth", {
				configurable: true,
				value: clientWidth,
			});
		};
		const Title = () => (
			<TooltipProvider>
				<Tooltip truncatedOnly>
					<TooltipTrigger asChild>
						<span data-testid="title">一个很长的标题</span>
					</TooltipTrigger>
					<TooltipContent>一个很长的标题，完整全文</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		);

		it("文字被截断时出现，内容是完整全文", () => {
			render(<Title />);
			metrics(screen.getByTestId("title"), 300, 120);
			hover(screen.getByTestId("title"));
			expect(screen.getByRole("tooltip").textContent).toBe("一个很长的标题，完整全文");
		});

		it("没有截断就不出现", () => {
			render(<Title />);
			metrics(screen.getByTestId("title"), 120, 120);
			hover(screen.getByTestId("title"));
			expect(bubble()).toBeNull();
			act(() => screen.getByTestId("title").focus());
			expect(bubble()).toBeNull();
		});
	});

	describe("相邻切换", () => {
		const animate = vi.fn();
		const rects = new WeakMap<Element, DOMRect>();

		beforeEach(() => {
			animate.mockReset();
			Element.prototype.animate = animate;
			// Radix Presence 收尾时用 CSS.escape，jsdom 没有
			vi.stubGlobal("CSS", { escape: (value: string) => value });
			vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
				this: Element,
			) {
				return rects.get(this) ?? new DOMRect(0, 0, 0, 0);
			});
			// jsdom 没有 CSS 动画：让收起中的气泡报出一个动画名，Radix 才会像浏览器里那样等退回动画结束再卸载
			const realGetComputedStyle = window.getComputedStyle.bind(window);
			vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => {
				const style = realGetComputedStyle(element, pseudo);
				return new Proxy(style, {
					get(target, prop) {
						if (prop === "animationName") {
							return element.getAttribute("data-state") === "closed"
								? "leave"
								: "none";
						}
						const value = Reflect.get(target, prop);
						return typeof value === "function" ? value.bind(target) : value;
					},
				});
			});
		});
		afterEach(() => {
			Reflect.deleteProperty(Element.prototype, "animate");
			vi.unstubAllGlobals();
		});

		it("提示还在时移到另一个触发器：同一个气泡滑过去，上一个立刻消失", async () => {
			render(<Toolbar />);
			hover(trigger("粗体"));
			await act(async () => {
				await vi.advanceTimersByTimeAsync(0);
			});
			const first = bubble()?.parentElement as HTMLElement;
			rects.set(first, new DOMRect(100, 40, 60, 28));

			unhover(trigger("粗体"));
			advance(60);
			expect(first.isConnected).toBe(true);
			expect(animate).not.toHaveBeenCalled();

			fireEvent.pointerMove(trigger("斜体"), { pointerType: "mouse" });
			const second = [
				...document.querySelectorAll<HTMLElement>("[data-slot='tooltip-content']"),
			].find((node) => node.textContent?.includes("倾斜"));
			expect(second?.getAttribute("data-state")).toBe("instant-open");
			expect(second?.hasAttribute("data-sliding")).toBe(true);
			rects.set(second?.parentElement as HTMLElement, new DOMRect(180, 40, 60, 28));
			await act(async () => {
				await vi.advanceTimersByTimeAsync(0);
			});

			expect(first.style.visibility).toBe("hidden");
			expect(animate).toHaveBeenCalledTimes(1);
			const [keyframes, options] = animate.mock.calls[0];
			expect(keyframes).toEqual([{ translate: "-80px 0px" }, { translate: "0 0" }]);
			expect(options).toMatchObject({
				duration: 180,
				easing: "cubic-bezier(0.32, 0.72, 0, 1)",
			});
			expect(animate.mock.contexts[0]).toBe(second?.parentElement);
		});

		it("上一个气泡已经消失就正常出现，不滑动", async () => {
			render(<Toolbar />);
			hover(trigger("粗体"));
			await act(async () => {
				await vi.advanceTimersByTimeAsync(0);
			});
			const first = bubble()?.parentElement as HTMLElement;
			unhover(trigger("粗体"));
			advance(60);
			act(() => {
				const end = Object.assign(new Event("animationend", { bubbles: true }), {
					animationName: "leave",
				});
				first.firstElementChild?.dispatchEvent(end);
			});
			expect(first.isConnected).toBe(false);

			fireEvent.pointerMove(trigger("斜体"), { pointerType: "mouse" });
			await act(async () => {
				await vi.advanceTimersByTimeAsync(0);
			});
			const second = [...document.querySelectorAll("[data-slot='tooltip-content']")].find(
				(node) => node.textContent?.includes("倾斜"),
			);
			expect(second?.hasAttribute("data-sliding")).toBe(false);
			expect(animate).not.toHaveBeenCalled();
		});
	});
});
