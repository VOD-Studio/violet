import type { DragEndEvent } from "@dnd-kit/core";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Sortable } from "../index";
import { useSortableList } from "../use-sortable-list";

const ITEMS = [
	{ id: "a", title: "第一章" },
	{ id: "b", title: "第二章" },
	{ id: "c", title: "第三章" },
];
const getId = (item: (typeof ITEMS)[number]) => item.id;
const getLabel = (item: (typeof ITEMS)[number]) => item.title;

// jsdom 没有布局；这里只提供拖放完成时 DnD 给出的两个矩形。
const drop = {
	active: {
		id: "a",
		rect: { current: { initial: { top: 0, bottom: 48, height: 48 } } },
	},
	over: { id: "c", rect: { top: 104, bottom: 152 } },
} as DragEndEvent;

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("Sortable 落位", () => {
	it("落位 160ms 后才提交，并保留等待期间的编辑、新增与移除", async () => {
		vi.useFakeTimers();
		const onReorder = vi.fn();
		const { result, rerender } = renderHook(
			({ items }) => useSortableList({ items, getId, getLabel, onReorder }),
			{ initialProps: { items: ITEMS } },
		);

		act(() => result.current.end(drop));
		expect(onReorder).not.toHaveBeenCalled();
		rerender({
			items: [{ id: "a", title: "第一章已修改" }, ITEMS[2], { id: "d", title: "新加入" }],
		});
		await act(() => vi.advanceTimersByTimeAsync(159));
		expect(onReorder).not.toHaveBeenCalled();
		await act(() => vi.advanceTimersByTimeAsync(1));

		expect(onReorder).toHaveBeenCalledExactlyOnceWith([
			ITEMS[2],
			{ id: "a", title: "第一章已修改" },
			{ id: "d", title: "新加入" },
		]);
		expect(result.current.message).toBe("已放在第 2 位");
	});

	it("减弱动态下不等待落位，失败不发布成功播报", async () => {
		vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
		const onReorder = vi.fn().mockRejectedValue(new Error("保存失败"));
		const { result } = renderHook(() =>
			useSortableList({ items: ITEMS, getId, getLabel, onReorder }),
		);

		await act(async () => result.current.end(drop));

		expect(onReorder).toHaveBeenCalledExactlyOnceWith([ITEMS[1], ITEMS[2], ITEMS[0]]);
		expect(result.current.message).toBe("排序没有成功，已恢复原顺序");
		expect(result.current.settling).toBeNull();
	});

	it("卸载会取消尚未提交的落位", async () => {
		vi.useFakeTimers();
		const onReorder = vi.fn();
		const { result, unmount } = renderHook(() =>
			useSortableList({ items: ITEMS, getId, getLabel, onReorder }),
		);
		act(() => result.current.end(drop));
		unmount();
		await act(() => vi.advanceTimersByTimeAsync(160));
		expect(onReorder).not.toHaveBeenCalled();
	});
});

function Fixture({ disabled = false }: { disabled?: boolean }) {
	const [items, setItems] = useState(ITEMS);
	return (
		<Sortable
			aria-label="章节顺序"
			items={items}
			getId={getId}
			getLabel={getLabel}
			onReorder={setItems}
			disabled={disabled}
			renderItem={(item) => <span>{item.title}</span>}
		/>
	);
}

describe("Sortable 移动菜单", () => {
	it("首项不能上移，下移后更新列表顺序并播报", async () => {
		render(<Fixture />);
		fireEvent.pointerDown(screen.getByRole("button", { name: "调整 第一章 的顺序" }), {
			button: 0,
			ctrlKey: false,
		});
		await waitFor(() => expect(screen.getByRole("menuitem", { name: "上移" })).toBeTruthy());
		expect(screen.getByRole("menuitem", { name: "上移" }).getAttribute("aria-disabled")).toBe(
			"true",
		);
		fireEvent.click(screen.getByRole("menuitem", { name: "下移" }));

		await waitFor(() =>
			expect(screen.getByText("第一章，已放在第 2 位").getAttribute("role")).toBe("status"),
		);
		const rows = screen.getByRole("list", { name: "章节顺序" }).querySelectorAll("li");
		expect(
			Array.from(rows).map((row) => row.querySelector(".v-sortable__content")?.textContent),
		).toEqual(["第二章", "第一章", "第三章"]);
		expect(
			screen.getByRole("button", { name: "移动 第一章，在第 2 位，共 3 项" }),
		).toBeTruthy();
	});

	it("禁用时把手和替代移动菜单都不能操作", () => {
		render(<Fixture disabled />);
		for (const button of screen.getAllByRole("button")) {
			expect((button as HTMLButtonElement).disabled).toBe(true);
		}
	});
});
