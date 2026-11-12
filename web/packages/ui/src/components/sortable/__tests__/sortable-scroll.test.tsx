import type { DragEndEvent, Modifier } from "@dnd-kit/core";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { restrictToList } from "../restrict-to-list";
import { useSortableList } from "../use-sortable-list";

const ITEMS = ["a", "b", "c"];
const getId = (item: string) => item;

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("Sortable 滚动坐标", () => {
	it("限制纸片时读取列表当前矩形，而不是拿起时的矩形", () => {
		const root = document.createElement("ol");
		let top = 200;
		vi.spyOn(root, "getBoundingClientRect").mockImplementation(
			() => new DOMRect(0, top, 300, 160),
		);
		const modifier = restrictToList({ current: root });
		const args: Parameters<Modifier>[0] = {
			activatorEvent: new Event("pointerdown"),
			active: null,
			activeNodeRect: null,
			over: null,
			overlayNodeRect: null,
			scrollableAncestors: [],
			scrollableAncestorRects: [],
			windowRect: new DOMRect(0, 0, 1280, 720),
			transform: { x: 30, y: 500, scaleX: 1, scaleY: 1 },
			draggingNodeRect: new DOMRect(0, 204, 300, 48),
			containerNodeRect: new DOMRect(0, 200, 300, 160),
		};
		expect(modifier(args)).toEqual({ x: 0, y: 104, scaleX: 1, scaleY: 1 });

		top = 140;
		expect(modifier(args)).toEqual({ x: 0, y: 44, scaleX: 1, scaleY: 1 });
	});

	it("拿起时矩形尚未初始化，滚动后仍按实际源槽位落定", () => {
		vi.useFakeTimers();
		const root = document.createElement("ol");
		const source = document.createElement("li");
		source.className = "v-sortable__slot";
		Object.defineProperty(source, "offsetTop", { value: 4 });
		const handle = document.createElement("button");
		source.appendChild(handle);
		root.appendChild(source);
		const activatorEvent = new Event("pointerdown");
		handle.dispatchEvent(activatorEvent);
		let top = 200;
		vi.spyOn(root, "getBoundingClientRect").mockImplementation(
			() => new DOMRect(0, top, 300, 160),
		);
		const { result } = renderHook(() =>
			useSortableList({ items: ITEMS, getId, getLabel: getId, onReorder: vi.fn() }),
		);
		result.current.root.current = root;
		const active: DragEndEvent["active"] = {
			id: "a",
			data: { current: {} },
			rect: { current: { initial: null, translated: null } },
		};
		const drop = {
			activatorEvent,
			collisions: null,
			delta: { x: 0, y: 0 },
			active,
			over: {
				id: "c",
				rect: new DOMRect(0, 308, 300, 48),
				disabled: false,
				data: { current: {} },
			},
		} satisfies DragEndEvent;
		act(() => result.current.start(drop));
		active.rect.current.initial = new DOMRect(0, 204, 300, 48);
		act(() => result.current.over(drop));
		expect(result.current.marker).toEqual({ top: 108, height: 48 });

		top = 140;
		const scrolled = {
			...drop,
			over: { ...drop.over, rect: new DOMRect(0, 248, 300, 48) },
		} satisfies DragEndEvent;
		act(() => result.current.over(scrolled));
		expect(result.current.marker).toEqual({ top: 108, height: 48 });
		act(() => result.current.end(scrolled));
		expect(result.current.settling?.distance).toBe(104);
	});
});
