import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type EmojiPickerGroup, type EmojiPickerItem, EmojiPickerPanel } from "../index";

const FACES: EmojiPickerItem[] = Array.from({ length: 24 }, (_, index) => ({
	id: `face-${index}`,
	name: `表情${index}`,
	content: "😀",
	placeholder: `[表情${index}]`,
	aliases: index === 0 ? ["smile", "wx"] : undefined,
	disabledReason: index === 2 ? "会员专属" : undefined,
	selected: index === 3 || index === 4,
}));
const GROUPS: EmojiPickerGroup[] = [
	{
		id: "small",
		label: "小黄脸",
		sections: [{ id: "faces", label: "小黄脸", density: "small", items: FACES }],
	},
	{
		id: "large",
		label: "猫猫",
		sections: [{ id: "cats", label: "猫猫", density: "large", items: FACES.slice(0, 11) }],
	},
	{
		id: "text",
		label: "颜文字",
		sections: [
			{
				id: "text",
				label: "颜文字",
				density: "text",
				items: FACES.slice(0, 8).map((item) => ({
					...item,
					content: "(・ω・)",
					placeholder: "(・ω・)",
				})),
			},
		],
	},
];

function Harness({ onSelect = () => {} }: { onSelect?: (item: EmojiPickerItem) => void }) {
	const [group, setGroup] = useState("small");
	return (
		<EmojiPickerPanel
			groups={GROUPS}
			activeGroup={group}
			onGroupChange={setGroup}
			onSelect={onSelect}
		/>
	);
}

function activeName() {
	const id = screen.getByRole("listbox").getAttribute("aria-activedescendant");
	return id ? document.getElementById(id)?.getAttribute("aria-label") : null;
}

afterEach(() => vi.useRealTimers());

describe("EmojiPickerPanel", () => {
	it("保留输入焦点，指针连续选取不抢焦点，不在挂载时主动聚焦", () => {
		const input = document.createElement("textarea");
		document.body.append(input);
		input.focus();
		const onSelect = vi.fn();
		const { unmount } = render(<Harness onSelect={onSelect} />);
		expect(document.activeElement).toBe(input);
		const first = screen.getByRole("option", { name: "表情0" });
		expect(fireEvent.mouseDown(first)).toBe(false);
		fireEvent.click(first);
		fireEvent.click(first);
		expect(onSelect).toHaveBeenCalledTimes(2);
		expect(onSelect).toHaveBeenLastCalledWith(FACES[0]);
		expect(document.activeElement).toBe(input);
		unmount();
		input.remove();
	});

	it("标签只有一个 Tab 停靠点，左右循环，Home/End 立即换组并移动焦点", () => {
		render(<Harness />);
		const tabs = screen.getAllByRole("tab");
		expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1, -1]);
		tabs[0].focus();
		fireEvent.keyDown(tabs[0], { key: "ArrowLeft" });
		expect(document.activeElement).toBe(tabs[2]);
		expect(tabs[2].getAttribute("aria-selected")).toBe("true");
		expect(screen.getByRole("listbox", { name: "颜文字表情" })).toBeTruthy();
		fireEvent.keyDown(tabs[2], { key: "Home" });
		expect(document.activeElement).toBe(tabs[0]);
		fireEvent.keyDown(tabs[0], { key: "End" });
		expect(document.activeElement).toBe(tabs[2]);
		fireEvent.keyDown(tabs[2], { key: "ArrowRight" });
		expect(document.activeElement).toBe(tabs[0]);
	});

	it.each([
		["small", 10, "表情23"],
		["large", 5, "表情10"],
		["text", 3, "表情7"],
	])("%s 按实际列数上下移动，焦点始终留在网格", (group, columns, lastName) => {
		const onSelect = vi.fn();
		render(
			<EmojiPickerPanel
				groups={GROUPS}
				activeGroup={group}
				onGroupChange={() => {}}
				onSelect={onSelect}
			/>,
		);
		const grid = screen.getByRole("listbox");
		grid.focus();
		fireEvent.keyDown(grid, { key: "Home" });
		expect(activeName()).toBe("表情0");
		fireEvent.keyDown(grid, { key: "ArrowDown" });
		expect(activeName()).toBe(`表情${columns}${columns === 3 ? "，已回应" : ""}`);
		fireEvent.keyDown(grid, { key: "ArrowUp" });
		expect(activeName()).toBe("表情0");
		fireEvent.keyDown(grid, { key: "ArrowRight" });
		fireEvent.keyDown(grid, { key: "Enter" });
		expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "face-1" }));
		expect(document.activeElement).toBe(grid);
		fireEvent.keyDown(grid, { key: "End" });
		expect(activeName()).toBe(lastName);
	});

	it("不可用与已回应选项仍可被键盘预览，但指针与回车都不能重复选取", () => {
		const onSelect = vi.fn();
		render(<Harness onSelect={onSelect} />);
		const grid = screen.getByRole("listbox");
		grid.focus();
		expect(grid.getAttribute("aria-multiselectable")).toBe("true");
		expect(screen.getAllByRole("option", { selected: true })).toHaveLength(2);
		fireEvent.keyDown(grid, { key: "Home" });
		fireEvent.keyDown(grid, { key: "ArrowRight" });
		fireEvent.keyDown(grid, { key: "ArrowRight" });
		expect(activeName()).toBe("表情2");
		expect(
			screen.getByRole("option", { name: "表情2" }).getAttribute("aria-description"),
		).toContain("会员专属");
		fireEvent.keyDown(grid, { key: "Enter" });
		fireEvent.click(screen.getByRole("option", { name: "表情2" }));
		fireEvent.keyDown(grid, { key: "ArrowRight" });
		expect(activeName()).toBe("表情3，已回应");
		const selected = screen.getByRole("option", { name: "表情3，已回应" });
		expect(selected.getAttribute("aria-selected")).toBe("true");
		expect(selected.getAttribute("aria-disabled")).toBe("true");
		fireEvent.keyDown(grid, { key: "Enter" });
		fireEvent.click(selected);
		expect(onSelect).not.toHaveBeenCalled();
		fireEvent.keyDown(grid, { key: "ArrowRight" });
		fireEvent.keyDown(grid, { key: " " });
		expect(onSelect).not.toHaveBeenCalled();
		fireEvent.keyDown(grid, { key: "ArrowRight" });
		fireEvent.keyDown(grid, { key: "Enter" });
		expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "face-5" }));
		expect(document.activeElement).toBe(grid);
	});

	it("allowSelected 时已回应项可再次触发 onSelect，禁用项仍不可选", () => {
		const onSelect = vi.fn();
		render(
			<EmojiPickerPanel
				groups={GROUPS}
				activeGroup="small"
				onGroupChange={() => {}}
				onSelect={onSelect}
				allowSelected
			/>,
		);
		const selected = screen.getAllByRole("option")[3];
		expect(selected.getAttribute("aria-disabled")).toBe("false");
		fireEvent.click(selected);
		expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "face-3" }));
		const grid = screen.getByRole("listbox");
		fireEvent.keyDown(grid, { key: "Home" });
		fireEvent.keyDown(grid, { key: "ArrowRight" });
		fireEvent.keyDown(grid, { key: "ArrowRight" });
		fireEvent.keyDown(grid, { key: "Enter" });
		expect(onSelect).toHaveBeenCalledTimes(1);
	});

	it("从不同密度的 section 跨行移动，上传格占列但不被当作表情选取", () => {
		const upload = vi.fn();
		const group: EmojiPickerGroup = {
			id: "mine",
			label: "收藏",
			sections: [
				{
					id: "uploaded",
					label: "我上传的",
					density: "large",
					action: (
						<button type="button" onClick={upload}>
							上传表情
						</button>
					),
					items: FACES.slice(0, 5),
				},
				{ id: "saved", label: "我收藏的", density: "text", items: FACES.slice(5, 11) },
			],
		};
		render(
			<EmojiPickerPanel
				groups={[group]}
				activeGroup="mine"
				onGroupChange={() => {}}
				onSelect={() => {}}
			/>,
		);
		const grid = screen.getByRole("listbox");
		const options = screen.getAllByRole("option");
		fireEvent.keyDown(grid, { key: "Home" });
		fireEvent.keyDown(grid, { key: "ArrowDown" });
		expect(grid.getAttribute("aria-activedescendant")).toBe(options[4].id);
		fireEvent.keyDown(grid, { key: "ArrowDown" });
		expect(grid.getAttribute("aria-activedescendant")).toBe(options[5].id);
		const uploadButton = screen.getByRole("button", { name: "上传表情" });
		expect(uploadButton.closest('[role="listbox"]')).toBeNull();
		expect(uploadButton.closest('[role="group"]')).toBeNull();
		uploadButton.focus();
		expect(document.activeElement).toBe(uploadButton);
		fireEvent.click(uploadButton);
		expect(upload).toHaveBeenCalledOnce();
	});

	it("各分组保留自己的滚动位置，宿主能受控恢复与接收滚动值", () => {
		const onScroll = vi.fn();
		const { rerender } = render(<Harness />);
		const grid = screen.getByRole("region", { name: "小黄脸表情浏览区" });
		fireEvent.scroll(grid, { target: { scrollTop: 64 } });
		fireEvent.click(screen.getByRole("tab", { name: "猫猫" }));
		expect(grid.scrollTop).toBe(0);
		fireEvent.scroll(grid, { target: { scrollTop: 24 } });
		fireEvent.click(screen.getByRole("tab", { name: "小黄脸" }));
		expect(grid.scrollTop).toBe(64);
		rerender(
			<EmojiPickerPanel
				groups={GROUPS}
				activeGroup="large"
				scrollTop={72}
				onScrollTopChange={onScroll}
				onGroupChange={() => {}}
				onSelect={() => {}}
			/>,
		);
		const controlled = screen.getByRole("region", { name: "猫猫表情浏览区" });
		expect(controlled.scrollTop).toBe(72);
		fireEvent.scroll(controlled, { target: { scrollTop: 88 } });
		expect(onScroll).toHaveBeenLastCalledWith(88);
	});

	it("加载、出错重试和空收藏都提供真实的可读状态与出口", () => {
		const retry = vi.fn();
		const base = {
			groups: GROUPS,
			activeGroup: "small",
			onGroupChange: vi.fn(),
			onSelect: vi.fn(),
		};
		const { rerender } = render(<EmojiPickerPanel {...base} />);
		expect(screen.getAllByRole("option")).toHaveLength(24);
		rerender(<EmojiPickerPanel {...base} status="loading" />);
		expect(screen.queryByRole("listbox")).toBeNull();
		expect(screen.getByRole("region").getAttribute("aria-busy")).toBe("true");
		expect(screen.getByRole("status").textContent).toContain("正在加载表情");
		expect(screen.queryAllByRole("option")).toHaveLength(0);
		rerender(
			<EmojiPickerPanel {...base} status="error" errorMessage="连接中断" onRetry={retry} />,
		);
		expect(screen.getByRole("alert").textContent).toContain("连接中断");
		expect(screen.queryByRole("listbox")).toBeNull();
		expect(screen.queryAllByRole("option")).toHaveLength(0);
		expect(
			screen.getByRole("button", { name: "重新加载" }).closest('[role="listbox"]'),
		).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "重新加载" }));
		expect(retry).toHaveBeenCalledOnce();
		rerender(
			<EmojiPickerPanel
				{...base}
				groups={[
					{
						id: "small",
						label: "收藏",
						sections: [
							{
								id: "empty",
								label: "我上传的",
								density: "large",
								items: [],
								emptyMessage: "上传图片或收藏正文里的表情",
								action: <button type="button">上传表情</button>,
							},
						],
					},
				]}
			/>,
		);
		expect(screen.getByText("上传图片或收藏正文里的表情")).toBeTruthy();
		expect(screen.getByRole("button", { name: "上传表情" })).toBeTruthy();
		expect(screen.queryByRole("listbox")).toBeNull();
	});
});
