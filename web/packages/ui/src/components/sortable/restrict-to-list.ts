import type { Modifier } from "@dnd-kit/core";

/** 纵向排序不允许纸片越过列表的内容边界。 */
export const restrictToList: Modifier = ({ transform, draggingNodeRect, containerNodeRect }) => {
	if (!draggingNodeRect || !containerNodeRect) return { ...transform, x: 0 };

	// 列表两端的 4px 留给聚焦环，纸片止于实际行区域。
	const minimum = containerNodeRect.top + 4 - draggingNodeRect.top;
	const maximum = containerNodeRect.bottom - 4 - draggingNodeRect.bottom;
	return {
		...transform,
		x: 0,
		y: Math.min(maximum, Math.max(minimum, transform.y)),
	};
};
