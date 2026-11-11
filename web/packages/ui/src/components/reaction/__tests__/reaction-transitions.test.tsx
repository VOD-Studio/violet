import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReactionBar, type ReactionItem } from "..";

const first: ReactionItem = { id: "first", name: "微笑", content: "🙂", count: 1, self: true };
const second: ReactionItem = { id: "second", name: "喜欢", content: "❤️", count: 5, self: false };
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("ReactionBar 真实数据过渡", () => {
	it("快速新增、移除再回滚同一ID不会复活旧数量，也不会被旧退场任务删除", () => {
		const onToggle = vi.fn();
		const { rerender } = render(<ReactionBar items={[second]} onToggle={onToggle} />);
		rerender(<ReactionBar items={[first, second]} onToggle={onToggle} />);
		advance(40);
		rerender(<ReactionBar items={[second]} onToggle={onToggle} />);
		advance(40);
		const restored = { ...first, count: 7, self: false };
		rerender(<ReactionBar items={[restored, second]} onToggle={onToggle} />);
		advance(500);
		expect(screen.getAllByRole("button", { name: "微笑，7 人" })).toHaveLength(1);
		expect(screen.queryByRole("button", { name: "微笑，1 人，你已回应" })).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "微笑，7 人" }));
		expect(onToggle).toHaveBeenCalledExactlyOnceWith("first");
	});

	it("count减到0与从集合移除具有相同的退场生命周期", () => {
		const onToggle = vi.fn();
		const { rerender } = render(<ReactionBar items={[first, second]} onToggle={onToggle} />);
		const removed = screen.getByRole("button", { name: "微笑，1 人，你已回应" });
		rerender(<ReactionBar items={[{ ...first, count: 0 }, second]} onToggle={onToggle} />);
		expect(screen.queryByRole("button", { name: "微笑，1 人，你已回应" })).toBeNull();
		advance(100);
		expect(removed.isConnected).toBe(true);
		advance(60);
		expect(removed.isConnected).toBe(false);
		expect(screen.getByRole("button", { name: "喜欢，5 人" })).toBeTruthy();
	});

	it("人数在99+范围内更新仍准确播报实际值，本人取消与失败恢复使用最新状态", () => {
		const onToggle = vi.fn();
		const { rerender } = render(
			<ReactionBar items={[{ ...first, count: 120 }]} onToggle={onToggle} />,
		);
		rerender(
			<ReactionBar items={[{ ...first, count: 119, self: false }]} onToggle={onToggle} />,
		);
		expect(screen.getByRole("button", { name: "微笑，119 人" }).textContent).toContain("99+");
		rerender(<ReactionBar items={[{ ...first, count: 121 }]} onToggle={onToggle} />);
		advance(500);
		const restored = screen.getByRole("button", { name: "微笑，121 人，你已回应" });
		expect(restored.getAttribute("aria-pressed")).toBe("true");
		fireEvent.click(restored);
		expect(onToggle).toHaveBeenCalledExactlyOnceWith("first");
	});

	it("并发更新另一种回应时不丢失现有内容，保留调用方提供的GIF", () => {
		const animated: ReactionItem = {
			...second,
			content: <img src="https://example.test/reaction.gif" alt="动态爱心" />,
		};
		const { rerender } = render(<ReactionBar items={[first, animated]} onToggle={vi.fn()} />);
		rerender(
			<ReactionBar items={[{ ...animated, count: 6, self: true }]} onToggle={vi.fn()} />,
		);
		advance(80);
		rerender(
			<ReactionBar
				items={[
					{ ...first, count: 2 },
					{ ...animated, count: 6, self: true },
				]}
				onToggle={vi.fn()}
			/>,
		);
		advance(500);
		expect(screen.getByRole("button", { name: "微笑，2 人，你已回应" })).toBeTruthy();
		const chip = screen.getByRole("button", { name: "喜欢，6 人，你已回应" });
		expect(chip.querySelector("img")?.getAttribute("src")).toBe(
			"https://example.test/reaction.gif",
		);
	});

	it("移除当前聚焦回应时移到邻近回应，移除最后一项时落到添加入口", () => {
		const onToggle = vi.fn();
		const onAdd = vi.fn();
		const { rerender } = render(
			<ReactionBar items={[first, second]} onToggle={onToggle} onAdd={onAdd} />,
		);
		act(() => screen.getByRole("button", { name: "微笑，1 人，你已回应" }).focus());
		rerender(<ReactionBar items={[second]} onToggle={onToggle} onAdd={onAdd} />);
		expect(document.activeElement).toBe(screen.getByRole("button", { name: "喜欢，5 人" }));
		rerender(<ReactionBar items={[]} onToggle={onToggle} onAdd={onAdd} />);
		expect(document.activeElement).toBe(screen.getByRole("button", { name: "添加回应" }));
	});

	it("宿主reduce下退场100ms结束，动画未结束就卸载不会留下后续节点", () => {
		const { rerender, unmount } = render(
			<section data-motion="reduce">
				<ReactionBar items={[first]} onToggle={vi.fn()} />
			</section>,
		);
		const removed = screen.getByRole("button", { name: "微笑，1 人，你已回应" });
		rerender(
			<section data-motion="reduce">
				<ReactionBar items={[]} onToggle={vi.fn()} />
			</section>,
		);
		advance(99);
		expect(removed.isConnected).toBe(true);
		advance(1);
		expect(removed.isConnected).toBe(false);
		rerender(
			<section data-motion="reduce">
				<ReactionBar items={[first]} onToggle={vi.fn()} />
			</section>,
		);
		unmount();
		advance(1000);
		expect(screen.queryByRole("button", { name: "微笑，1 人，你已回应" })).toBeNull();
	});
	it("系统reduce同样在100ms完成退场", () => {
		vi.spyOn(window, "matchMedia").mockImplementation((media) => ({
			matches: media.includes("prefers-reduced-motion"),
			media,
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(() => false),
		}));
		const { rerender } = render(<ReactionBar items={[first]} onToggle={vi.fn()} />);
		const removed = screen.getByRole("button", { name: "微笑，1 人，你已回应" });
		rerender(<ReactionBar items={[]} onToggle={vi.fn()} />);
		advance(99);
		expect(removed.isConnected).toBe(true);
		advance(1);
		expect(removed.isConnected).toBe(false);
	});

	it("折叠入口因回应减少而消失时把焦点交还可见回应", () => {
		const onToggle = vi.fn();
		const { rerender } = render(
			<ReactionBar items={[first, second]} collapseAfter={1} onToggle={onToggle} />,
		);
		act(() => screen.getByRole("button", { name: "展开另外 1 种回应" }).focus());
		rerender(<ReactionBar items={[first]} collapseAfter={1} onToggle={onToggle} />);
		expect(document.activeElement).toBe(
			screen.getByRole("button", { name: "微笑，1 人，你已回应" }),
		);
	});
	it("用户已离开到页面空白时，后续移除曾聚焦的回应不抢回焦点", () => {
		const { rerender } = render(<ReactionBar items={[first, second]} />);
		const button = screen.getByRole("button", { name: "微笑，1 人，你已回应" });
		// jsdom 的 blur 会把 Document 当成 relatedTarget；浏览器点空白时为 null。
		const blurToBody = (event: FocusEvent) => {
			Object.defineProperty(event, "relatedTarget", { value: null });
		};
		document.addEventListener("focusout", blurToBody, true);
		try {
			act(() => button.focus());
			act(() => button.blur());
		} finally {
			document.removeEventListener("focusout", blurToBody, true);
		}
		expect(document.activeElement).toBe(document.body);
		rerender(<ReactionBar items={[second]} />);
		advance(200);
		expect(document.activeElement).toBe(document.body);
	});
});
