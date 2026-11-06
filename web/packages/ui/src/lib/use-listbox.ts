"use client";

import {
	type KeyboardEvent,
	type PointerEvent,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { pinyinInitials } from "./pinyin-initials";

/** 引擎认识的一项：`id` 就是选项行的 DOM id，也是 `aria-activedescendant` 指向的值。 */
export interface ListboxItem {
	id: string;
	disabled?: boolean;
	/** 前缀预测输入匹配的文字；汉字另按拼音声母匹配。缺省不参与预测。 */
	textValue?: string;
}

/** 最近一次操作来自键盘还是指针。键盘模式下只给高亮行画自身底色。 */
export type ListboxMode = "keyboard" | "pointer";

export interface UseListboxOptions {
	/** 有序的选项；禁用项留在数组里，由引擎跳过。 */
	items: readonly ListboxItem[];
	/** 面板是否展开。收起时高亮复位，重新展开回到初始项。 */
	open: boolean;
	/** 高亮项变化时调用，无高亮为 `null`；初次展开的默认高亮也会触发。 */
	onActiveChange?: (item: ListboxItem | null, index: number) => void;
	/** 方向键到头后是否循环，默认不循环。 */
	loop?: boolean;
	/** 字符键前缀预测输入，默认关闭；焦点在输入框里的形态不要开。 */
	typeahead?: boolean;
	/** PageUp / PageDown 一次移动的项数，默认 8。 */
	pageSize?: number;
	/** 展开后默认高亮的项（通常是已选项）；找不到或被禁用时按 `activateFirst` 处理。 */
	initialActiveId?: string | null;
	/** 没有 `initialActiveId` 时是否默认高亮第一个可用项，默认否。 */
	activateFirst?: boolean;
	/**
	 * `aria-selected` 的语义：`"selected"` 由 `getItemProps` 的 `selected` 决定（选择器）；
	 * `"active"` 表示当前高亮项（组合框，选项的选中状态另有表达）。默认 `"selected"`。
	 */
	selectedFor?: "selected" | "active";
}

export interface ListboxItemProps {
	id: string;
	role: "option";
	"aria-selected": boolean;
	"aria-disabled"?: true;
	"data-active"?: "";
	"data-kb"?: "";
	onPointerMove: (event: PointerEvent<HTMLElement>) => void;
}

export interface UseListboxResult {
	/** 高亮项下标，没有为 `-1`。收起时恒为 `-1`。 */
	activeIndex: number;
	/** 高亮项 id，用作触发器或输入框的 `aria-activedescendant`；没有为 `undefined`。 */
	activeId: string | undefined;
	mode: ListboxMode;
	/** 直接指定高亮项；小于 0 表示清空高亮（不会回到默认项）。默认按键盘来源处理并滚动到可见。 */
	setActiveIndex: (index: number, mode?: ListboxMode) => void;
	/** 单独切换模式，例如点击展开时调用方把模式置回指针。 */
	setMode: (mode: ListboxMode) => void;
	/**
	 * 处理 ↑ ↓ Home End PageUp PageDown 与（开启时）字符键。返回 `true` 表示已处理，
	 * 调用方应 `preventDefault`。未展开时恒返回 `false`，展开本身由调用方决定。
	 */
	handleKeyDown: (event: KeyboardEvent<Element>) => boolean;
	/** 选项行要展开的属性。行元素另用 `registerItem` 登记。 */
	getItemProps: (index: number, state?: { selected?: boolean }) => ListboxItemProps;
	/** 登记或注销一行的 DOM 元素（以 id 为键），供滚动使用；回调保持稳定，可放进 effect。 */
	registerItem: (id: string, element: HTMLElement | null) => void;
	/** 把高亮行滚进可视区；`center` 只在行所在的滚动容器内居中，不会带动页面滚动。 */
	scrollActiveIntoView: (block?: "nearest" | "center") => void;
}

const TYPEAHEAD_MS = 500;

function enabledIndexes(items: readonly ListboxItem[]) {
	const result: number[] = [];
	items.forEach((item, index) => {
		if (!item.disabled) result.push(index);
	});
	return result;
}

function matchesPrefix(item: ListboxItem, query: string) {
	if (item.disabled || !item.textValue) return false;
	const text = item.textValue.toLowerCase();
	return text.startsWith(query) || pinyinInitials(item.textValue).toLowerCase().startsWith(query);
}

function scrollParent(element: HTMLElement) {
	for (let node = element.parentElement; node; node = node.parentElement) {
		const { overflowY } = getComputedStyle(node);
		if (
			(overflowY === "auto" || overflowY === "scroll") &&
			node.scrollHeight > node.clientHeight
		) {
			return node;
		}
	}
	return null;
}

/**
 * 焦点留在触发器或输入框、用 `aria-activedescendant` 指向高亮项的 listbox 引擎。
 *
 * 不碰 DOM 结构，也不接管选值：它只维护「哪一项高亮」，调用方在 Enter 等时机读 `activeIndex`。
 * 高亮以 id 保存，选项被筛掉或重排后跟着 id 走，不会指错行。
 *
 * @example
 * ```tsx
 * const listbox = useListbox({ items, open, activateFirst: true, typeahead: true });
 * <button
 *   role="combobox"
 *   aria-activedescendant={listbox.activeId}
 *   onKeyDown={(event) => listbox.handleKeyDown(event) && event.preventDefault()}
 * />
 * ```
 */
export function useListbox({
	items,
	open,
	onActiveChange,
	loop = false,
	typeahead = false,
	pageSize = 8,
	initialActiveId = null,
	activateFirst = false,
	selectedFor = "selected",
}: UseListboxOptions): UseListboxResult {
	// undefined 表示还没有人动过高亮，沿用默认项；null 表示调用方明确清空
	const [chosen, setChosen] = useState<string | null | undefined>(undefined);
	const [mode, setModeState] = useState<ListboxMode>("pointer");
	const [prevOpen, setPrevOpen] = useState(open);
	if (open !== prevOpen) {
		setPrevOpen(open);
		setChosen(undefined);
	}

	const elements = useRef(new Map<string, HTMLElement>());
	const scrollNext = useRef(false);
	const activeIdRef = useRef<string | undefined>(undefined);
	const pointerAt = useRef<{ x: number; y: number } | null>(null);
	const typed = useRef({ buffer: "", timer: 0 });

	let activeIndex = -1;
	if (open) {
		const wanted =
			chosen !== undefined
				? chosen
				: items.some((item) => item.id === initialActiveId && !item.disabled)
					? initialActiveId
					: null;
		if (wanted !== null) {
			activeIndex = items.findIndex((item) => item.id === wanted && !item.disabled);
		} else if (chosen === undefined && activateFirst) {
			activeIndex = items.findIndex((item) => !item.disabled);
		}
	}
	const activeItem = activeIndex >= 0 ? items[activeIndex] : null;
	const activeId = activeItem?.id;
	activeIdRef.current = activeId;

	const callbackRef = useRef(onActiveChange);
	callbackRef.current = onActiveChange;
	const reported = useRef<{ id: string | undefined; index: number }>({
		id: undefined,
		index: -1,
	});
	useEffect(() => {
		// 同一项换了下标（选项重排）也要重新报告
		if (reported.current.id === activeId && reported.current.index === activeIndex) return;
		reported.current = { id: activeId, index: activeIndex };
		callbackRef.current?.(activeItem, activeIndex);
	}, [activeId, activeItem, activeIndex]);

	const registerItem = useCallback((id: string, element: HTMLElement | null) => {
		if (element) elements.current.set(id, element);
		else elements.current.delete(id);
	}, []);

	const scrollActiveIntoView = useCallback(
		(block: "nearest" | "center" = "nearest") => {
			const element = activeId ? elements.current.get(activeId) : undefined;
			if (!element) return;
			if (block === "nearest") {
				element.scrollIntoView({ block: "nearest" });
				return;
			}
			const parent = scrollParent(element);
			if (parent) {
				parent.scrollTop =
					element.offsetTop - (parent.clientHeight - element.offsetHeight) / 2;
			}
		},
		[activeId],
	);

	// 键盘引起的变化才滚动：鼠标滑过引起的变化若再滚动，会出现滚动、悬停、再滚动的循环
	// biome-ignore lint/correctness/useExhaustiveDependencies: 只在高亮项变化时检查是否需要滚动
	useLayoutEffect(() => {
		if (!scrollNext.current) return;
		scrollNext.current = false;
		scrollActiveIntoView("nearest");
	}, [activeId]);

	useEffect(() => {
		if (open) return;
		window.clearTimeout(typed.current.timer);
		typed.current.buffer = "";
	}, [open]);
	useEffect(() => () => window.clearTimeout(typed.current.timer), []);

	const activate = useCallback(
		(index: number, nextMode: ListboxMode) => {
			setModeState(nextMode);
			const nextId = index >= 0 ? (items[index]?.id ?? null) : null;
			// 只有键盘真的换了高亮项才需要滚动；指针激活清掉尚未消费的标记，避免之后被它误触发
			scrollNext.current =
				nextMode === "keyboard" && nextId !== null && nextId !== activeIdRef.current;
			setChosen(nextId);
		},
		[items],
	);

	const setActiveIndex = useCallback(
		(index: number, nextMode: ListboxMode = "keyboard") => activate(index, nextMode),
		[activate],
	);

	const setMode = useCallback((next: ListboxMode) => setModeState(next), []);

	const step = (from: number, direction: 1 | -1, count: number) => {
		const enabled = enabledIndexes(items);
		if (enabled.length === 0) return -1;
		const position = enabled.indexOf(from);
		if (position === -1) {
			// 还没有高亮：向下取第一个，向上取最后一个
			return direction === 1 ? enabled[0] : enabled[enabled.length - 1];
		}
		let next = position + direction * count;
		if (loop) next = ((next % enabled.length) + enabled.length) % enabled.length;
		else next = Math.min(enabled.length - 1, Math.max(0, next));
		return enabled[next];
	};

	const handleKeyDown = (event: KeyboardEvent<Element>): boolean => {
		if (!open || event.nativeEvent.isComposing) return false;
		const enabled = enabledIndexes(items);
		if (event.altKey || event.ctrlKey || event.metaKey) return false;
		let target: number | null = null;
		switch (event.key) {
			case "ArrowDown":
				target = step(activeIndex, 1, 1);
				break;
			case "ArrowUp":
				target = step(activeIndex, -1, 1);
				break;
			case "PageDown":
				target = step(activeIndex, 1, pageSize);
				break;
			case "PageUp":
				target = step(activeIndex, -1, pageSize);
				break;
			case "Home":
				target = enabled[0] ?? -1;
				break;
			case "End":
				target = enabled[enabled.length - 1] ?? -1;
				break;
			default: {
				if (!typeahead || event.key.length !== 1) return false;
				const state = typed.current;
				if (event.key === " " && state.buffer === "") return false;
				state.buffer += event.key.toLowerCase();
				window.clearTimeout(state.timer);
				state.timer = window.setTimeout(() => {
					state.buffer = "";
				}, TYPEAHEAD_MS);
				// 同一个字符连按是在同首字母的项之间轮换，而不是匹配一个重复串
				const cycling = [...state.buffer].every((char) => char === state.buffer[0]);
				const query = cycling ? state.buffer[0] : state.buffer;
				const start = cycling || activeIndex < 0 ? activeIndex + 1 : activeIndex;
				for (let offset = 0; offset < items.length; offset++) {
					const index = (start + offset) % items.length;
					if (matchesPrefix(items[index], query)) {
						target = index;
						break;
					}
				}
				if (target === null) return true;
			}
		}
		if (target !== null && target >= 0) activate(target, "keyboard");
		else setModeState("keyboard");
		return true;
	};

	const getItemProps = (index: number, state?: { selected?: boolean }): ListboxItemProps => {
		const item = items[index];
		const active = index === activeIndex;
		return {
			id: item.id,
			role: "option",
			"aria-selected": selectedFor === "active" ? active : Boolean(state?.selected),
			"aria-disabled": item.disabled ? true : undefined,
			"data-active": active ? "" : undefined,
			"data-kb": active && mode === "keyboard" ? "" : undefined,
			onPointerMove: (event) => {
				// 键盘滚动后浏览器会补发一次指针移动，坐标没变就不算真的移动
				const last = pointerAt.current;
				pointerAt.current = { x: event.clientX, y: event.clientY };
				if (item.disabled || (last && last.x === event.clientX && last.y === event.clientY))
					return;
				if (active && mode === "pointer") return;
				activate(index, "pointer");
			},
		};
	};

	return {
		activeIndex,
		activeId,
		mode,
		setActiveIndex,
		setMode,
		handleKeyDown,
		getItemProps,
		registerItem,
		scrollActiveIntoView,
	};
}
