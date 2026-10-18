import type { KeyboardEvent, ReactNode } from "react";
import { cardAttributes } from "./drag/dom.ts";

export interface CardItemProps {
	cardId: string;
	origin: boolean;
	draggable: boolean;
	lifted: boolean;
	settling: boolean;
	/** 键盘操作说明元素的 id。 */
	hintId: string;
	onKeyDown?(event: KeyboardEvent<HTMLElement>): void;
	children: ReactNode;
}

/** 列表里的一张卡片：数据属性与键盘入口；内容由使用方渲染。 */
export function CardItem({
	cardId,
	origin,
	draggable,
	lifted,
	settling,
	hintId,
	onKeyDown,
	children,
}: CardItemProps) {
	return (
		<li
			className="v-kanban__card"
			{...cardAttributes({ cardId, origin, draggable, lifted, settling })}
			tabIndex={draggable ? 0 : undefined}
			aria-describedby={draggable ? hintId : undefined}
			onKeyDown={draggable ? onKeyDown : undefined}
		>
			{children}
		</li>
	);
}
