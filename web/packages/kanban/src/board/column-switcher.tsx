import { type KeyboardEvent, useLayoutEffect, useRef } from "react";
import { CountBadge } from "./count-badge.tsx";
import type { BoardMessages } from "./messages.ts";

/** 切换器里的一项：对应一列。 */
export interface SwitcherColumn {
	id: string;
	title: string;
	count: number;
	/** 筛选生效时匹配的卡片数；没有筛选为 null。 */
	matched: number | null;
}

export interface ColumnSwitcherProps {
	columns: readonly SwitcherColumn[];
	activeId: string;
	onSelect(columnId: string): void;
	/** 当前列所在面板的 id；标签的 `aria-controls` 指向它。 */
	panelId: string;
	/** 标签 id 的前缀，面板据此用 `aria-labelledby` 指回标签。 */
	idPrefix: string;
	messages: BoardMessages;
}

/** 当前列的标签 id。 */
export const switcherTabId = (idPrefix: string, columnId: string) => `${idPrefix}-tab-${columnId}`;

/** 横向滚动的标签条放得下的最小内边距：聚焦环外扩 2px 线宽加 2px 偏移。 */
const REVEAL_PADDING = 4;

/**
 * 列切换器：窄屏一次只显示一列时，顶部的标签条。
 *
 * 标签是自动激活的：方向键移动焦点的同时切换列，Home/End 到首尾。
 */
export function ColumnSwitcher({
	columns,
	activeId,
	onSelect,
	panelId,
	idPrefix,
	messages,
}: ColumnSwitcherProps) {
	const listRef = useRef<HTMLDivElement>(null);

	// 标签条放不下时横向滚动，选中的标签要在可见范围内；只改标签条自己的 scrollLeft，不牵动页面滚动
	// biome-ignore lint/correctness/useExhaustiveDependencies: activeId 变化才需要重新对齐，副作用读取的是 DOM
	useLayoutEffect(() => {
		const list = listRef.current;
		const tab = list?.querySelector<HTMLElement>('[aria-selected="true"]');
		if (!list || !tab) return;
		const start = tab.offsetLeft - REVEAL_PADDING;
		const end = tab.offsetLeft + tab.offsetWidth + REVEAL_PADDING;
		if (start < list.scrollLeft) list.scrollLeft = Math.max(start, 0);
		else if (end > list.scrollLeft + list.clientWidth) list.scrollLeft = end - list.clientWidth;
	}, [activeId]);

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.ctrlKey || event.metaKey || event.altKey) return;
		const index = columns.findIndex((column) => column.id === activeId);
		const target =
			event.key === "ArrowRight"
				? (index + 1) % columns.length
				: event.key === "ArrowLeft"
					? (index - 1 + columns.length) % columns.length
					: event.key === "Home"
						? 0
						: event.key === "End"
							? columns.length - 1
							: -1;
		if (target < 0) return;
		event.preventDefault();
		onSelect(columns[target].id);
		const tabs = event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]');
		tabs[target]?.focus();
	};

	return (
		<div
			ref={listRef}
			role="tablist"
			aria-label={messages.switcherLabel}
			className="v-kanban__switcher"
			onKeyDown={onKeyDown}
		>
			{columns.map((column) => {
				const active = column.id === activeId;
				return (
					<button
						key={column.id}
						type="button"
						role="tab"
						id={switcherTabId(idPrefix, column.id)}
						aria-selected={active}
						aria-controls={active ? panelId : undefined}
						tabIndex={active ? 0 : -1}
						className="v-kanban__tab"
						data-active={active ? "true" : undefined}
						onClick={() => onSelect(column.id)}
					>
						<span className="v-kanban__tab-title">{column.title}</span>{" "}
						<CountBadge
							count={column.count}
							matched={column.matched}
							messages={messages}
						/>
					</button>
				);
			})}
		</div>
	);
}
