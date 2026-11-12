import {
	type KeyboardEvent,
	type RefObject,
	type UIEvent,
	useCallback,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { type EmojiPreviewState, useEmojiPreview } from "./emoji-preview";
import { type EmojiCell, nextEmojiCell } from "./navigation";
import type { EmojiPickerItem, EmojiPickerPanelProps } from "./types";

interface EmojiNavigationOptions {
	root: RefObject<HTMLDivElement | null>;
	viewport: RefObject<HTMLDivElement | null>;
	groupId: string;
	cells: readonly EmojiCell[];
	cellsByKey: ReadonlyMap<string, EmojiCell>;
	status: NonNullable<EmojiPickerPanelProps["status"]>;
	scrollTop?: number;
	onScrollTopChange?: (value: number) => void;
	onSelect: (item: EmojiPickerItem) => void;
}

interface EmojiNavigationState {
	activeKey: string | null;
	options: Map<string, HTMLButtonElement>;
	labels: Map<string, HTMLDivElement>;
	preview: EmojiPreviewState;
	highlight: (cell: EmojiCell, element: HTMLElement, moved: boolean) => void;
	handleScroll: (event: UIEvent<HTMLDivElement>) => void;
	handleKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
	allowHover: () => void;
	hidePreview: () => void;
}

/** 维护组内高亮与预览，方向键移动不把焦点转移到单个表情。 */
export function useEmojiNavigation({
	root,
	viewport,
	groupId,
	cells,
	cellsByKey,
	status,
	scrollTop,
	onScrollTopChange,
	onSelect,
}: EmojiNavigationOptions): EmojiNavigationState {
	const options = useRef(new Map<string, HTMLButtonElement>());
	const labels = useRef(new Map<string, HTMLDivElement>());
	const positions = useRef(new Map<string, number>());
	const hoverAllowed = useRef(true);
	const [active, setActive] = useState<{ group: string; key: string } | null>(null);
	const preview = useEmojiPreview(root, viewport, cellsByKey, options.current);
	const activeKey = active?.group === groupId ? active.key : null;
	const activeIndex = cells.findIndex((cell) => cell.key === activeKey);
	const highlightState = useRef({
		activeKey,
		preview: preview.preview,
		visible: preview.visible,
	});

	useLayoutEffect(() => {
		highlightState.current = { activeKey, preview: preview.preview, visible: preview.visible };
	}, [activeKey, preview.preview, preview.visible]);

	useLayoutEffect(() => {
		if (status === "ready" && viewport.current) {
			viewport.current.scrollTop = scrollTop ?? positions.current.get(groupId) ?? 0;
		}
	}, [groupId, scrollTop, status, viewport]);

	const { show, hide, keep } = preview;
	useLayoutEffect(() => {
		if (status !== "ready" || active?.group !== groupId) {
			hide(true);
		}
	}, [groupId, status, active?.group, hide]);

	const highlight = useCallback(
		(cell: EmojiCell, element: HTMLElement, moved: boolean) => {
			if (moved) {
				hoverAllowed.current = true;
			}
			if (!hoverAllowed.current) {
				return;
			}
			const current = highlightState.current;
			if (
				current.activeKey === cell.key &&
				current.visible &&
				current.preview?.key === cell.key
			) {
				keep();
				return;
			}
			setActive({ group: groupId, key: cell.key });
			show(cell, element);
		},
		[groupId, keep, show],
	);

	const handleScroll = (event: UIEvent<HTMLDivElement>) => {
		const value = event.currentTarget.scrollTop;
		positions.current.set(groupId, value);
		onScrollTopChange?.(value);
		if (hoverAllowed.current) {
			hide(true);
			return;
		}
		const cell = cells[activeIndex];
		const element = cell ? options.current.get(cell.key) : undefined;
		if (cell && element) {
			show(cell, element);
		}
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.target !== event.currentTarget || status !== "ready") {
			return;
		}
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			const item = cells[activeIndex]?.item;
			if (item && !item.disabledReason && !item.selected) {
				onSelect(item);
			}
			return;
		}
		if (!Object.hasOwn(NAVIGATION_KEYS, event.key)) {
			return;
		}
		event.preventDefault();
		const next = nextEmojiCell(cells, activeIndex, event.key);
		if (next < 0) {
			return;
		}
		hoverAllowed.current = false;
		const cell = cells[next];
		setActive({ group: groupId, key: cell.key });
		const element = options.current.get(cell.key);
		if (element && viewport.current) {
			revealEmojiCell(element, viewport.current, labels.current.get(cell.section.id));
			show(cell, element);
		}
	};

	const allowHover = () => {
		hoverAllowed.current = true;
	};
	const hidePreview = () => {
		hide();
	};

	return {
		activeKey,
		options: options.current,
		labels: labels.current,
		preview,
		highlight,
		handleScroll,
		handleKeyDown,
		allowHover,
		hidePreview,
	};
}

const NAVIGATION_KEYS: Record<string, true> = {
	ArrowLeft: true,
	ArrowRight: true,
	ArrowUp: true,
	ArrowDown: true,
	Home: true,
	End: true,
};
// ScrollArea 在可继续滚动的边缘覆盖 24px 渐隐。
const FADE_SIZE = 24;

function revealEmojiCell(
	element: HTMLElement,
	viewport: HTMLElement,
	label: HTMLElement | undefined,
) {
	const topInset = Math.max(FADE_SIZE, label?.getBoundingClientRect().height ?? 0);
	const viewportBounds = viewport.getBoundingClientRect();
	const bounds = element.getBoundingClientRect();
	const top = bounds.top - viewportBounds.top + viewport.scrollTop;
	const bottom = top + bounds.height;
	if (top < viewport.scrollTop + topInset) {
		viewport.scrollTop = Math.max(0, top - topInset);
	} else if (bottom > viewport.scrollTop + viewport.clientHeight - FADE_SIZE) {
		viewport.scrollTop = bottom - viewport.clientHeight + FADE_SIZE;
	}
}
