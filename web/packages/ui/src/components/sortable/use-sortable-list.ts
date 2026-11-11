import type { DragEndEvent, DragStartEvent, UniqueIdentifier } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { type RefObject, useEffect, useRef, useState } from "react";
import type { SortableProps } from "./sortable";

export interface SettlingItem {
	id: UniqueIdentifier;
	from: number;
	to: number;
	distance: number;
	height: number;
}

interface SortableListState {
	activeId: UniqueIdentifier | null;
	settling: SettlingItem | null;
	message: string;
	root: RefObject<HTMLOListElement | null>;
	start: (event: DragStartEvent) => void;
	cancel: () => void;
	end: (event: DragEndEvent) => void;
	move: (index: number, direction: number) => Promise<void>;
}

type SortableListOptions<T> = Pick<SortableProps<T>, "items" | "getId" | "getLabel" | "onReorder">;

/** 落位后再提交受控顺序；等待期间的表单值仍以最新 items 为准。 */
export function useSortableList<T>({
	items,
	getId,
	getLabel,
	onReorder,
}: SortableListOptions<T>): SortableListState {
	const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
	const [settling, setSettling] = useState<SettlingItem | null>(null);
	const [message, setMessage] = useState("");
	const root = useRef<HTMLOListElement>(null);
	const activator = useRef<HTMLElement | null>(null);
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const latest = useRef({ items, getId, onReorder });
	latest.current = { items, getId, onReorder };

	useEffect(() => () => clearTimeout(timer.current), []);

	useEffect(() => {
		if (activeId !== null || settling) return;
		// DOM 重排可能让浏览器把焦点交给 body，继续保留在同一项目的把手上。
		activator.current?.focus({ preventScroll: true });
		activator.current = null;
	}, [activeId, settling]);

	const start = ({ active }: DragStartEvent) => {
		const focused = document.activeElement;
		activator.current =
			focused instanceof HTMLElement && root.current?.contains(focused) ? focused : null;
		setMessage("");
		setActiveId(active.id);
	};

	const cancel = () => {
		clearTimeout(timer.current);
		setActiveId(null);
		setSettling(null);
	};

	const commitOrder = async (order: UniqueIdentifier[], active: UniqueIdentifier) => {
		const current = latest.current;
		const byId = new Map(current.items.map((item) => [current.getId(item), item]));
		const reordered: T[] = [];
		// 只快照标识，不快照内容；同时保留等待期间新增或移除的项目。
		for (const id of order) {
			if (byId.has(id)) {
				reordered.push(byId.get(id) as T);
				byId.delete(id);
			}
		}
		reordered.push(...byId.values());

		try {
			await current.onReorder(reordered);
			const position = reordered.findIndex((item) => current.getId(item) === active);
			setMessage(position < 0 ? "排序已更新" : `已放在第 ${position + 1} 位`);
		} catch {
			setMessage("排序没有成功，已恢复原顺序");
		} finally {
			setSettling(null);
		}
	};

	const end = ({ active, over }: DragEndEvent) => {
		setActiveId(null);
		if (!over) return;

		const from = items.findIndex((item) => getId(item) === active.id);
		const to = items.findIndex((item) => getId(item) === over.id);
		const initial = active.rect.current.initial;
		if (from < 0 || to < 0 || !initial) return;
		if (from === to) {
			setMessage(`已放在第 ${to + 1} 位`);
			return;
		}

		setSettling({
			id: active.id,
			from,
			to,
			height: initial.height,
			distance: from < to ? over.rect.bottom - initial.bottom : over.rect.top - initial.top,
		});
		const order = arrayMove(items.map(getId), from, to);
		const reduceMotion =
			matchMedia("(prefers-reduced-motion: reduce)").matches ||
			root.current?.closest('[data-motion="reduce"]');

		if (reduceMotion) {
			void commitOrder(order, active.id);
		} else {
			// 与纸片落位的 CSS 时长一致，完成后才改变 DOM 顺序。
			timer.current = setTimeout(() => void commitOrder(order, active.id), 160);
		}
	};

	const move = async (index: number, direction: number) => {
		const target = index + direction;
		if (target < 0 || target >= items.length) return;

		setMessage("");
		try {
			await onReorder(arrayMove([...items], index, target));
			setMessage(`${getLabel(items[index])}，已放在第 ${target + 1} 位`);
		} catch {
			setMessage("排序没有成功，已恢复原顺序");
		}
	};

	return { activeId, settling, message, root, start, cancel, end, move };
}
