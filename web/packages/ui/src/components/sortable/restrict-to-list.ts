import type { DragOverEvent, Modifier, UniqueIdentifier } from "@dnd-kit/core";
import type { RefObject } from "react";

/** 纵向排序使用列表的实时边界，滚动后仍不允许纸片越过内容区域。 */
export function restrictToList(root: RefObject<HTMLOListElement | null>): Modifier {
	return ({ transform, draggingNodeRect }) => {
		const list = root.current?.getBoundingClientRect();
		if (!draggingNodeRect || !list) {
			return { ...transform, x: 0 };
		}

		// 列表两端的 4px 留给聚焦环，纸片止于实际行区域。
		const minimum = list.top + 4 - draggingNodeRect.top;
		const maximum = list.bottom - 4 - draggingNodeRect.bottom;
		return {
			...transform,
			x: 0,
			y: Math.min(maximum, Math.max(minimum, transform.y)),
		};
	};
}

/** 占位与落位共用列表内部坐标，避免把视口滚动差计入纸片移动距离。 */
export function getDropSlot(
	{ active, over }: Pick<DragOverEvent, "active" | "over">,
	root: HTMLOListElement | null,
	ids: readonly UniqueIdentifier[],
) {
	const initial = active.rect.current.initial;
	const from = ids.indexOf(active.id);
	const to = over ? ids.indexOf(over.id) : -1;
	if (!initial || !over || from < 0 || to < 0) {
		return null;
	}

	let top = over.rect.top;
	if (from < to) {
		top = over.rect.bottom - initial.height;
	}
	top -= root?.getBoundingClientRect().top ?? 0;
	return { from, to, top, height: initial.height };
}
