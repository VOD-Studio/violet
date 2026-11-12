import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type EmojiPickerItem, EmojiPickerPanel } from "../../emoji-picker";
import { ReactionBar } from "..";

const recent: EmojiPickerItem[] = Array.from({ length: 10 }, (_, index) => ({
	id: `system:${index}`,
	name: `表情${index}`,
	content: "🙂",
	placeholder: `[表情${index}]`,
}));
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

function FullPicker({ close, onSelect }: { close: () => void; onSelect: (id: string) => void }) {
	const [group, setGroup] = useState("faces");
	return (
		<EmojiPickerPanel
			activeGroup={group}
			onGroupChange={setGroup}
			groups={[
				{
					id: "faces",
					label: "小黄脸",
					sections: [{ id: "faces", label: "小黄脸", density: "small", items: recent }],
				},
				{
					id: "animals",
					label: "动物",
					sections: [
						{
							id: "animals",
							label: "动物",
							density: "small",
							items: [
								{ ...recent[0], id: "system:cat", name: "猫咪", content: "🐱" },
							],
						},
					],
				},
			]}
			onSelect={(item) => {
				onSelect(item.id);
				close();
			}}
		/>
	);
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe("ReactionBar 添加与键盘", () => {
	it("快捷条最多八项，已回应与目录禁用项仍可聚焦但不能重复选择", () => {
		const onAdd = vi.fn();
		render(
			<ReactionBar
				items={[{ id: recent[0].id, name: "表情0", content: "🙂", count: 1, self: true }]}
				onAdd={onAdd}
				recentItems={recent.map((item, index) => ({
					...item,
					disabledReason: index === 1 ? "不可用" : undefined,
					selected: index === 2,
				}))}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: "添加回应" }));
		const toolbar = screen.getByRole("toolbar", { name: "常用回应" });
		expect(within(toolbar).getAllByRole("button")).toHaveLength(8);
		expect(within(toolbar).queryByRole("button", { name: "表情8" })).toBeNull();
		for (const name of ["表情0，已回应", "表情1", "表情2，已回应"]) {
			const button = within(toolbar).getByRole("button", { name });
			act(() => button.focus());
			expect(document.activeElement).toBe(button);
			expect(button.getAttribute("aria-disabled")).toBe("true");
			fireEvent.click(button);
		}
		expect(onAdd).not.toHaveBeenCalled();
		fireEvent.click(within(toolbar).getByRole("button", { name: "表情3" }));
		expect(onAdd).toHaveBeenCalledExactlyOnceWith("system:3");
		expect(screen.getByRole("button", { name: "添加回应" }).getAttribute("aria-expanded")).toBe(
			"false",
		);
		advance(100);
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(document.activeElement).toBe(screen.getByRole("button", { name: "添加回应" }));
	});

	it("快捷条只占一个Tab停靠位，左右循环并包含更多入口，Esc回到原按钮", () => {
		render(
			<ReactionBar
				items={[]}
				onAdd={vi.fn()}
				recentItems={recent.slice(0, 2)}
				renderPicker={({ close }) => <FullPicker close={close} onSelect={vi.fn()} />}
			/>,
		);
		const add = screen.getByRole("button", { name: "添加回应" });
		fireEvent.click(add);
		const toolbar = screen.getByRole("toolbar");
		const first = within(toolbar).getByRole("button", { name: "表情0" });
		const second = within(toolbar).getByRole("button", { name: "表情1" });
		const more = within(toolbar).getByRole("button", { name: "更多表情" });
		expect(document.activeElement).toBe(first);
		expect(
			within(toolbar)
				.getAllByRole("button")
				.filter((button) => button.tabIndex === 0),
		).toEqual([first]);
		fireEvent.keyDown(first, { key: "ArrowLeft" });
		expect(document.activeElement).toBe(more);
		fireEvent.keyDown(more, { key: "ArrowRight" });
		expect(document.activeElement).toBe(first);
		fireEvent.keyDown(first, { key: "ArrowRight" });
		expect(document.activeElement).toBe(second);
		fireEvent.keyDown(second, { key: "Escape" });
		advance(100);
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(document.activeElement).toBe(add);
	});

	it("真实完整选择器接替快捷条，选择后直接收回原按钮，退场期间不闪回快捷条", () => {
		const onSelect = vi.fn();
		render(
			<ReactionBar
				items={[]}
				onAdd={onSelect}
				recentItems={recent}
				renderPicker={({ close }) => <FullPicker close={close} onSelect={onSelect} />}
			/>,
		);
		const add = screen.getByRole("button", { name: "添加回应" });
		const controls = add.getAttribute("aria-controls");
		fireEvent.click(add);
		fireEvent.click(screen.getByRole("button", { name: "更多表情" }));
		expect(screen.getAllByRole("dialog")).toHaveLength(1);
		expect(screen.getByRole("dialog", { name: "选择回应" }).id).toBe(controls);
		expect(screen.queryByRole("toolbar")).toBeNull();
		const grid = screen.getByRole("listbox");
		act(() => grid.focus());
		fireEvent.keyDown(grid, { key: "Home" });
		fireEvent.keyDown(grid, { key: "Enter" });
		expect(onSelect).toHaveBeenCalledExactlyOnceWith("system:0");
		expect(add.getAttribute("aria-expanded")).toBe("false");
		expect(screen.queryByRole("toolbar")).toBeNull();
		expect(screen.getByRole("dialog", { name: "选择回应" })).toBeTruthy();
		advance(100);
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(document.activeElement).toBe(add);
		advance(220);
		fireEvent.click(add);
		expect(screen.getByRole("toolbar")).toBeTruthy();
	});

	it("完整面板关闭途中反转保留当前导航，旧退场任务不会卸载重新打开的面板", () => {
		render(
			<ReactionBar
				items={[]}
				onAdd={vi.fn()}
				recentItems={recent}
				renderPicker={({ close }) => <FullPicker close={close} onSelect={vi.fn()} />}
			/>,
		);
		const add = screen.getByRole("button", { name: "添加回应" });
		fireEvent.click(add);
		fireEvent.click(screen.getByRole("button", { name: "更多表情" }));
		fireEvent.click(screen.getByRole("tab", { name: "动物" }));
		fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
		advance(40);
		fireEvent.click(add);
		advance(300);
		expect(add.getAttribute("aria-expanded")).toBe("true");
		expect(screen.getByRole("tab", { name: "动物" }).getAttribute("aria-selected")).toBe(
			"true",
		);
		expect(screen.getByRole("option", { name: "猫咪" })).toBeTruthy();
	});

	it("请求禁用期间关闭已打开面板，不允许旧快捷操作继续触发", () => {
		const onAdd = vi.fn();
		const props = { items: [], onAdd, recentItems: recent };
		const { rerender } = render(<ReactionBar {...props} />);
		fireEvent.click(screen.getByRole("button", { name: "添加回应" }));
		rerender(<ReactionBar {...props} disabled />);
		fireEvent.click(screen.getByRole("button", { name: "表情0" }));
		advance(100);
		expect(onAdd).not.toHaveBeenCalled();
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("焦点移到外部可聚焦控件时收起且不抢回焦点", () => {
		render(
			<>
				<ReactionBar items={[]} onAdd={vi.fn()} recentItems={recent} />
				<button type="button">继续编辑</button>
			</>,
		);
		fireEvent.click(screen.getByRole("button", { name: "添加回应" }));
		const outside = screen.getByRole("button", { name: "继续编辑" });
		act(() => outside.focus());
		advance(100);
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(document.activeElement).toBe(outside);
	});
});
