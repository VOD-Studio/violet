import type { KeyboardEvent, ReactNode } from "react";
import { cardAttributes } from "./drag/dom.ts";
import { MoveMenu } from "./move-menu.tsx";

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
	/** 键盘操作说明元素的 id。 */
	hintId: string;
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
	hintId,
	menu,
	onKeyDown,
	children,
}: CardItemProps) {
	return (
		<li
			className="v-kanban__card"
			{...cardAttributes({ cardId, origin, draggable, lifted, settling })}
			data-dimmed={dimmed ? "true" : undefined}
			tabIndex={draggable ? 0 : undefined}
			aria-describedby={draggable ? hintId : undefined}
			onKeyDown={draggable ? onKeyDown : undefined}
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
