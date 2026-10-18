import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { EDITABLE_SELECTOR } from "../editable.ts";
import { cardAttributes } from "./drag/dom.ts";
import { MoveMenu } from "./move-menu.tsx";

/** 点击这些元素不算选中卡片：它们有自己的点击语义。 */
const OWN_CLICK = `a, button, summary, ${EDITABLE_SELECTOR}, [data-kanban-no-select]`;

export interface CardItemProps {
	cardId: string;
	/** 卡片所在的列。 */
	columnId: string;
	origin: boolean;
	draggable: boolean;
	lifted: boolean;
	settling: boolean;
	/** 筛选生效且这张卡片不匹配：淡化显示，位置不变。 */
	dimmed?: boolean;
	/** 淡化的卡片上给读屏的提示。 */
	dimmedText?: string;
	/** 被选中的卡片。 */
	selected?: boolean;
	/** 与被选中的卡片直接相连。 */
	related?: boolean;
	/** 有选中的卡片，而这张既不是它也不与它相连：淡化。 */
	faded?: boolean;
	/** 点击或键盘可以选中这张卡片；不可拖的卡片因此可聚焦。 */
	selectable?: boolean;
	onSelect?(): void;
	/** 键盘操作说明元素的 id（可拖的卡片拿起用）。 */
	hintId: string;
	/** 选中说明元素的 id：可选中的卡片据此知道怎么用键盘选中。 */
	selectHintId?: string;
	/** 「移到…」菜单；不提供则不显示。 */
	menu?: {
		mode: "hover" | "always";
		label: string;
		triggerText: string;
		targets: ReadonlyArray<{ id: string; title: string }>;
		onSelect(columnId: string): void;
	};
	onKeyDown?(event: KeyboardEvent<HTMLElement>): void;
	children: ReactNode;
}

/** 列表里的一张卡片：数据属性、键盘入口与「移到…」菜单；内容由使用方渲染。 */
export function CardItem({
	cardId,
	columnId,
	origin,
	draggable,
	lifted,
	settling,
	dimmed,
	dimmedText,
	selected,
	related,
	faded,
	selectable,
	onSelect,
	hintId,
	selectHintId,
	menu,
	onKeyDown,
	children,
}: CardItemProps) {
	// 可拖的卡片 Enter 与空格是拿起，选中改用 Alt+Enter；不可拖的卡片直接用 Enter 或空格
	const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
		const activate = event.key === "Enter" || event.key === " ";
		if (
			selectable &&
			activate &&
			event.target === event.currentTarget &&
			(!draggable || event.altKey) &&
			!event.ctrlKey &&
			!event.metaKey
		) {
			event.preventDefault();
			onSelect?.();
			return;
		}
		if (draggable) onKeyDown?.(event);
	};
	const handleClick = (event: MouseEvent<HTMLElement>) => {
		const own = (event.target as Element).closest(OWN_CLICK);
		if (own && own !== event.currentTarget && event.currentTarget.contains(own)) return;
		onSelect?.();
	};
	const describedBy =
		[draggable ? hintId : undefined, selectable ? selectHintId : undefined]
			.filter(Boolean)
			.join(" ") || undefined;
	return (
		<li
			className="v-kanban__card"
			{...cardAttributes({ cardId, origin, draggable, lifted, settling })}
			data-dimmed={dimmed ? "true" : undefined}
			data-selected={selected ? "true" : undefined}
			data-related={related ? "true" : undefined}
			data-faded={faded ? "true" : undefined}
			aria-current={selected ? "true" : undefined}
			tabIndex={draggable || selectable ? 0 : undefined}
			aria-describedby={describedBy}
			onKeyDown={draggable || selectable ? handleKeyDown : undefined}
			onClick={selectable ? handleClick : undefined}
		>
			{children}
			{dimmed ? <span className="v-kanban__sr-only">{dimmedText}</span> : null}
			{draggable && menu ? (
				<MoveMenu
					label={menu.label}
					triggerText={menu.triggerText}
					mode={menu.mode}
					targets={menu.targets.filter((target) => target.id !== columnId)}
					onSelect={menu.onSelect}
				/>
			) : null}
		</li>
	);
}
