import type { DragEndEvent, DragOverEvent, DragStartEvent, UniqueIdentifier } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { type RefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { getDropSlot } from "./restrict-to-list";
import type { SortableProps } from "./sortable";

/** 纸片的落位几何；受控顺序确认前保持目标位置。 */
export interface SettlingItem {
	id: UniqueIdentifier;
	from: number;
	to: number;
	distance: number;
	height: number;
}

interface DropMarker {
	top: number;
	height: number;
}

interface PendingOrder {
	ids: UniqueIdentifier[];
	active: UniqueIdentifier;
	label?: string;
	saved: boolean;
}

interface SortableListState {
	activeId: UniqueIdentifier | null;
	settling: SettlingItem | null;
	marker: DropMarker | null;
	busy: boolean;
	message: string;
	root: RefObject<HTMLOListElement | null>;
	start: (event: DragStartEvent) => void;
	over: (event: DragOverEvent) => void;
	cancel: () => void;
	end: (event: DragEndEvent) => void;
	move: (index: number, direction: number) => Promise<void>;
}

type SortableListOptions<T> = Pick<SortableProps<T>, "items" | "getId" | "getLabel" | "onReorder">;

function hasAppliedOrder(ids: readonly UniqueIdentifier[], expected: readonly UniqueIdentifier[]) {
	const existing = new Set(ids);
	const remaining = expected.filter((id) => existing.has(id));
	const expectedIds = new Set(remaining);
	const current = ids.filter((id) => expectedIds.has(id));
	return current.every((id, index) => id === remaining[index]);
}

/** 落位后再提交受控顺序；等待期间的表单值仍以最新 items 为准。 */
export function useSortableList<T>({
	items,
	getId,
	getLabel,
	onReorder,
}: SortableListOptions<T>): SortableListState {
	const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
	const [settling, setSettling] = useState<SettlingItem | null>(null);
	const [marker, setMarker] = useState<DropMarker | null>(null);
	const [pending, setPending] = useState<PendingOrder | null>(null);
	const [message, setMessage] = useState("");
	const root = useRef<HTMLOListElement>(null);
	const activator = useRef<HTMLElement | null>(null);
	const sourceTop = useRef<number | null>(null);
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const submission = useRef<PendingOrder | null>(null);
	const latest = useRef({ items, getId, getLabel, onReorder });
	latest.current = { items, getId, getLabel, onReorder };
	const ids = useMemo(() => items.map(getId), [items, getId]);
	const applied = pending !== null && hasAppliedOrder(ids, pending.ids);

	useEffect(() => {
		return () => {
			clearTimeout(timer.current);
			submission.current = null;
		};
	}, []);

	useLayoutEffect(() => {
		if (!pending?.saved) {
			return;
		}
		const position = ids.indexOf(pending.active);
		if (position >= 0 && !applied) {
			return;
		}

		// Promise 成功不代表宿主已更新 items；确认仍存在的 ID 相对顺序后才解锁。
		let announcement = "排序已更新";
		if (position >= 0) {
			const prefix = pending.label === undefined ? "" : `${pending.label}，`;
			announcement = `${prefix}已放在第 ${position + 1} 位`;
		}
		setMessage(announcement);
		submission.current = null;
		setPending(null);
		setSettling(null);
		setMarker(null);
	}, [ids, pending, applied]);

	useLayoutEffect(() => {
		if (activeId !== null || pending) {
			return;
		}
		// DOM 重排可能让浏览器把焦点交给 body，继续保留在同一项目的把手上。
		activator.current?.focus({ preventScroll: true });
		activator.current = null;
	}, [activeId, pending]);

	const start = ({ active, activatorEvent }: DragStartEvent) => {
		if (submission.current) {
			return;
		}
		const focused = document.activeElement;
		activator.current =
			focused instanceof HTMLElement && root.current?.contains(focused) ? focused : null;
		const initial = active.rect.current.initial;
		const target = activatorEvent.target;
		const slot = target instanceof Element ? target.closest(".v-sortable__slot") : null;
		sourceTop.current = null;
		// 拿起事件可能早于矩形初始化；布局坐标不会随祖先滚动而改变。
		if (slot instanceof HTMLElement && root.current?.contains(slot)) {
			sourceTop.current = slot.offsetTop;
		} else if (initial) {
			sourceTop.current = initial.top - (root.current?.getBoundingClientRect().top ?? 0);
		}
		setMessage("");
		setActiveId(active.id);
	};

	const over = (event: DragOverEvent) => {
		const slot = getDropSlot(event, root.current, ids);
		if (!slot) {
			return;
		}
		setMarker({ top: slot.top, height: slot.height });
	};

	const cancel = () => {
		setActiveId(null);
		setMarker(null);
	};

	const commitOrder = async (transaction: PendingOrder) => {
		if (submission.current !== transaction) {
			return;
		}
		const current = latest.current;
		const byId = new Map(current.items.map((item) => [current.getId(item), item]));
		const reordered: T[] = [];
		// 只快照标识，不快照内容；同时保留等待期间新增或移除的项目。
		for (const id of transaction.ids) {
			if (byId.has(id)) {
				reordered.push(byId.get(id) as T);
				byId.delete(id);
			}
		}
		reordered.push(...byId.values());

		try {
			await current.onReorder(reordered);
			if (submission.current === transaction) {
				setPending({ ...transaction, ids: reordered.map(current.getId), saved: true });
			}
		} catch {
			if (submission.current === transaction) {
				submission.current = null;
				setPending(null);
				setSettling(null);
				setMarker(null);
				setMessage("排序没有成功，已恢复原顺序");
			}
		}
	};

	const end = (event: DragEndEvent) => {
		if (submission.current) {
			return;
		}
		setActiveId(null);
		const slot = getDropSlot(event, root.current, ids);
		const initial = event.active.rect.current.initial;
		if (!slot || !initial) {
			setMarker(null);
			return;
		}
		if (slot.from === slot.to) {
			setMarker(null);
			setMessage(`已放在第 ${slot.to + 1} 位`);
			return;
		}

		const origin =
			sourceTop.current ?? initial.top - (root.current?.getBoundingClientRect().top ?? 0);
		setSettling({
			id: event.active.id,
			from: slot.from,
			to: slot.to,
			height: slot.height,
			distance: slot.top - origin,
		});
		const transaction = {
			ids: arrayMove(ids, slot.from, slot.to),
			active: event.active.id,
			saved: false,
		};
		submission.current = transaction;
		setPending(transaction);
		const reduceMotion =
			matchMedia("(prefers-reduced-motion: reduce)").matches ||
			(root.current?.closest('[data-motion="reduce"]') ?? null) !== null;
		if (reduceMotion) {
			void commitOrder(transaction);
		} else {
			// 与纸片落位的 CSS 时长一致，完成后才改变 DOM 顺序。
			timer.current = setTimeout(() => void commitOrder(transaction), 160);
		}
	};

	const move = async (index: number, direction: number) => {
		if (submission.current || activeId !== null) {
			return;
		}
		const current = latest.current;
		const target = index + direction;
		if (
			index < 0 ||
			index >= current.items.length ||
			target < 0 ||
			target >= current.items.length
		) {
			return;
		}

		activator.current =
			root.current?.querySelectorAll<HTMLElement>(".v-sortable__handle")[index] ?? null;
		const transaction = {
			ids: arrayMove(current.items.map(current.getId), index, target),
			active: current.getId(current.items[index]),
			label: current.getLabel(current.items[index]),
			saved: false,
		};
		submission.current = transaction;
		setPending(transaction);
		setMessage("");
		await commitOrder(transaction);
	};

	return {
		activeId,
		settling: applied ? null : settling,
		marker: applied ? null : marker,
		busy: pending !== null,
		message,
		root,
		start,
		over,
		cancel,
		end,
		move,
	};
}
