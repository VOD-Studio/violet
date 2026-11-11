import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReactionBar, type ReactionItem } from "..";

const smile: ReactionItem = {
	id: "system:smile",
	name: "微笑",
	content: "🙂",
	count: 128,
	self: true,
	recentUsers: [{ name: "本人", self: true }, { name: "小雨" }, { name: "阿明" }],
};
const heart: ReactionItem = {
	id: "system:heart",
	name: "喜欢",
	content: "❤️",
	count: 2,
	self: false,
};
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const hover = (element: HTMLElement) => {
	fireEvent.pointerMove(element, { pointerType: "mouse" });
	advance(0);
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe("ReactionBar 回应集合", () => {
	it("截断显示人数但为读屏保留实际人数与本人状态，切换只报告稳定 ID", () => {
		const onToggle = vi.fn();
		render(<ReactionBar items={[smile, heart]} onToggle={onToggle} />);
		const chip = screen.getByRole("button", { name: "微笑，128 人，你已回应" });
		expect(chip.textContent).toContain("99+");
		expect(chip.getAttribute("aria-pressed")).toBe("true");
		fireEvent.click(chip);
		expect(onToggle).toHaveBeenCalledWith("system:smile");
		expect(chip.getAttribute("aria-pressed")).toBe("true");
	});

	it("名单去除重复本人，最多展示两位其他人，余数按实际展示人数计算", () => {
		render(<ReactionBar items={[smile]} onToggle={vi.fn()} />);
		hover(screen.getByRole("button", { name: "微笑，128 人，你已回应" }));
		expect(screen.getByRole("tooltip").textContent).toBe("微笑 · 你、小雨、阿明和另外 125 人");
	});

	it("没有可公开的名字时只显示人数；只知道本人时仍准确显示其余人数", () => {
		const { rerender } = render(<ReactionBar items={[heart]} onToggle={vi.fn()} />);
		hover(screen.getByRole("button", { name: "喜欢，2 人" }));
		expect(screen.getByRole("tooltip").textContent).toBe("喜欢 · 2 人");
		rerender(<ReactionBar items={[{ ...heart, self: true }]} onToggle={vi.fn()} />);
		expect(screen.getByRole("tooltip").textContent).toBe("喜欢 · 你和另外 1 人");
	});

	it("相邻回应共享立即出现的名单提示，切换后只保留当前描述", () => {
		render(<ReactionBar items={[smile, heart]} onToggle={vi.fn()} />);
		hover(screen.getByRole("button", { name: "微笑，128 人，你已回应" }));
		hover(screen.getByRole("button", { name: "喜欢，2 人" }));
		expect(screen.getAllByRole("tooltip")).toHaveLength(1);
		expect(screen.getByRole("tooltip").textContent).toBe("喜欢 · 2 人");
	});

	it("只读集合仍可通过焦点读取名单", () => {
		render(<ReactionBar items={[heart]} />);
		act(() => screen.getByLabelText("喜欢，2 人").focus());
		expect(screen.getByRole("tooltip").textContent).toBe("喜欢 · 2 人");
	});

	it("达到上限仍允许取消本人回应，未选项与添加入口只报告上限", () => {
		const onToggle = vi.fn();
		const onLimit = vi.fn();
		const onAdd = vi.fn();
		render(
			<ReactionBar
				items={[smile, heart]}
				maxSelected={1}
				onToggle={onToggle}
				onAdd={onAdd}
				onLimit={onLimit}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: "微笑，128 人，你已回应" }));
		fireEvent.click(screen.getByRole("button", { name: "喜欢，2 人" }));
		const add = screen.getByRole("button", { name: "添加回应" });
		act(() => add.focus());
		expect(document.activeElement).toBe(add);
		expect(add.getAttribute("aria-disabled")).toBe("true");
		expect(add.getAttribute("aria-describedby")).toBeTruthy();
		fireEvent.click(add);
		expect(onToggle).toHaveBeenCalledExactlyOnceWith("system:smile");
		expect(onLimit).toHaveBeenCalledTimes(2);
		expect(onAdd).not.toHaveBeenCalled();
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("disabled 不转发回应、添加或上限提示，恢复后仍由新数据决定状态", () => {
		const onToggle = vi.fn();
		const onLimit = vi.fn();
		const onAdd = vi.fn();
		const props = { items: [smile, heart], maxSelected: 1, onToggle, onLimit, onAdd };
		const { rerender } = render(<ReactionBar {...props} disabled />);
		fireEvent.click(screen.getByRole("button", { name: "微笑，128 人，你已回应" }));
		fireEvent.click(screen.getByRole("button", { name: "喜欢，2 人" }));
		fireEvent.click(screen.getByRole("button", { name: "添加回应" }));
		expect(onToggle).not.toHaveBeenCalled();
		expect(onLimit).not.toHaveBeenCalled();
		expect(onAdd).not.toHaveBeenCalled();
		rerender(<ReactionBar {...props} items={[{ ...smile, self: false }, heart]} />);
		fireEvent.click(screen.getByRole("button", { name: "喜欢，2 人" }));
		expect(onToggle).toHaveBeenCalledWith("system:heart");
	});

	it("折叠只影响可见集合，展开与收起保留原始回应数据", () => {
		const items = Array.from({ length: 8 }, (_, index) => ({
			...heart,
			id: String(index),
			name: `回应${index}`,
		}));
		render(<ReactionBar items={items} collapseAfter={6} onToggle={vi.fn()} />);
		expect(screen.queryByRole("button", { name: "回应6，2 人" })).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "展开另外 2 种回应" }));
		expect(screen.getByRole("button", { name: "回应7，2 人" })).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "收起回应" }));
		advance(200);
		expect(screen.queryByRole("button", { name: "回应7，2 人" })).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "展开另外 2 种回应" }));
		expect(screen.getByRole("button", { name: "回应7，2 人" })).toBeTruthy();
	});

	it("上限计算包含被折叠的本人回应", () => {
		const onLimit = vi.fn();
		render(
			<ReactionBar
				items={[heart, smile]}
				collapseAfter={1}
				maxSelected={1}
				onToggle={vi.fn()}
				onLimit={onLimit}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: "喜欢，2 人" }));
		expect(onLimit).toHaveBeenCalledOnce();
	});
});
