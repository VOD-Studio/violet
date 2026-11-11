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

// jsdom 没有布局；两端矩形按三行、48px 行高与 4px 间隔构造。
const drop = {
	activatorEvent: new Event("pointerdown"),
	collisions: null,
	delta: { x: 0, y: 0 },
	active: {
		id: "a",
		data: { current: {} },
		rect: { current: { initial: new DOMRect(0, 0, 300, 48), translated: null } },
	},
	over: {
		id: "c",
		rect: new DOMRect(0, 104, 300, 48),
		disabled: false,
		data: { current: {} },
	},
} satisfies DragEndEvent;

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
		expect(result.current.message).toBe("");
		expect(result.current.settling).not.toBeNull();
		rerender({
			items: [ITEMS[2], { id: "a", title: "第一章已修改" }, { id: "d", title: "新加入" }],
		});
		expect(result.current.message).toBe("已放在第 2 位");
		expect(result.current.settling).toBeNull();
	});

	it("保存已完成但受控顺序未到达时保留落位与提交锁", async () => {
		vi.useFakeTimers();
		const onReorder = vi.fn().mockResolvedValue(undefined);
		const { result, rerender } = renderHook(
			({ items }) => useSortableList({ items, getId, getLabel, onReorder }),
			{ initialProps: { items: ITEMS } },
		);

		act(() => result.current.end(drop));
		await act(() => vi.advanceTimersByTimeAsync(160));
		expect(result.current.settling?.id).toBe("a");
		expect(result.current.busy).toBe(true);
		expect(result.current.message).toBe("");
		await act(() => result.current.move(0, 1));
		expect(onReorder).toHaveBeenCalledTimes(1);

		rerender({
			items: [{ id: "d", title: "新加入" }, ITEMS[2], { id: "a", title: "第一章已修改" }],
		});
		expect(result.current.settling).toBeNull();
		expect(result.current.busy).toBe(false);
		expect(result.current.message).toBe("已放在第 3 位");
	});

	it("等待受控顺序时删除被拖项目会结束落位", async () => {
		vi.useFakeTimers();
		const onReorder = vi.fn().mockResolvedValue(undefined);
		const { result, rerender } = renderHook(
			({ items }) => useSortableList({ items, getId, getLabel, onReorder }),
			{ initialProps: { items: ITEMS } },
		);
		act(() => result.current.end(drop));
		await act(() => vi.advanceTimersByTimeAsync(160));
		rerender({ items: [ITEMS[1], ITEMS[2]] });
		expect(result.current.settling).toBeNull();
		expect(result.current.busy).toBe(false);
		expect(result.current.message).toBe("排序已更新");
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

	it("等待受控顺序期间菜单不能重复打开，把手仍可聚焦", async () => {
		const onReorder = vi.fn().mockResolvedValue(undefined);
		const renderList = (items: typeof ITEMS) => (
			<Sortable
				aria-label="章节顺序"
				items={items}
				getId={getId}
				getLabel={getLabel}
				onReorder={onReorder}
				renderItem={(item) => <span>{item.title}</span>}
			/>
		);
		const { rerender } = render(renderList(ITEMS));
		fireEvent.pointerDown(screen.getByRole("button", { name: "调整 第一章 的顺序" }), {
			button: 0,
			ctrlKey: false,
		});
		const down = await screen.findByRole("menuitem", { name: "下移" });
		fireEvent.click(down);
		await act(async () => {});
		const menu = screen.getByRole("button", { name: "调整 第一章 的顺序" });
		expect((menu as HTMLButtonElement).disabled).toBe(true);
		fireEvent.pointerDown(menu, { button: 0, ctrlKey: false });
		expect(onReorder).toHaveBeenCalledExactlyOnceWith([ITEMS[1], ITEMS[0], ITEMS[2]]);
		expect(screen.getByRole("list", { name: "章节顺序" }).getAttribute("aria-busy")).toBe(
			"true",
		);
		const handle = screen.getByRole("button", { name: "移动 第一章，在第 1 位，共 3 项" });
		expect((handle as HTMLButtonElement).disabled).toBe(false);
		handle.focus();
		expect(document.activeElement).toBe(handle);
		expect(screen.queryByText("第一章，已放在第 2 位")).toBeNull();

		rerender(renderList([ITEMS[1], ITEMS[0], ITEMS[2]]));
		expect(screen.getByRole("list", { name: "章节顺序" }).hasAttribute("aria-busy")).toBe(
			false,
		);
		expect(screen.getByText("第一章，已放在第 2 位").getAttribute("role")).toBe("status");
		expect(document.activeElement).toBe(handle);
	});

	it("菜单请求尚未完成或仍待受控确认时共用提交锁", async () => {
		const { promise: saved, resolve: resolveSave } = Promise.withResolvers<void>();
		const onReorder = vi.fn(() => saved);
		const { result, rerender } = renderHook(
			({ items }) => useSortableList({ items, getId, getLabel, onReorder }),
			{ initialProps: { items: ITEMS } },
		);
		act(() => {
			void result.current.move(0, 1);
			void result.current.move(0, 1);
		});
		expect(onReorder).toHaveBeenCalledTimes(1);
		expect(result.current.busy).toBe(true);

		await act(async () => {
			resolveSave();
			await saved;
		});
		await act(() => result.current.move(0, 1));
		expect(onReorder).toHaveBeenCalledTimes(1);
		expect(result.current.busy).toBe(true);
		expect(result.current.message).toBe("");

		rerender({ items: [ITEMS[1], ITEMS[0], ITEMS[2]] });
		expect(result.current.busy).toBe(false);
		expect(result.current.message).toBe("第一章，已放在第 2 位");
	});

	it("禁用时把手和替代移动菜单都不能操作", () => {
		render(<Fixture disabled />);
		for (const button of screen.getAllByRole("button")) {
			expect((button as HTMLButtonElement).disabled).toBe(true);
		}
	});
});
