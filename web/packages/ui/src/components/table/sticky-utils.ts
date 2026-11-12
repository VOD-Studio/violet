import type { CSSProperties } from "react";
import type { DataTableColumn } from "./data-table-types";

/** 固定列偏移信息 */
export interface StickyOffset {
	side: "left" | "right";
	/** 累积偏移，如 "120px" */
	offset: string;
	/** 是否为该侧最靠内的固定列（横向滚动时在它的边缘出细线与渐隐） */
	isLast: boolean;
}

/** 固定列写在 th/td 上的 data 属性与内联偏移；边缘线由 CSS 按滚动状态显示。 */
export interface StickyProps {
	"data-sticky"?: "left" | "right";
	"data-sticky-edge"?: "";
	style?: CSSProperties;
}

/**
 * 预计算固定列的左右偏移，同侧多列按宽度累加。
 *
 * 优先使用 widthMap 中的实际宽度（含拖拽调整后的值），回退到 col.width 的 px 解析。
 */
export function computeStickyOffsets<T>(
	columns: DataTableColumn<T>[],
	widthMap?: Map<string, number>,
): Map<string, StickyOffset> {
	const map = new Map<string, StickyOffset>();

	let left = 0;
	let lastLeft: string | undefined;
	for (const col of columns) {
		if (col.sticky !== "left") continue;
		map.set(col.key, { side: "left", offset: `${left}px`, isLast: false });
		left += widthMap?.get(col.key) ?? parseWidth(col.width);
		lastLeft = col.key;
	}
	markLast(map, lastLeft);

	let right = 0;
	let lastRight: string | undefined;
	for (let i = columns.length - 1; i >= 0; i -= 1) {
		const col = columns[i];
		if (col?.sticky !== "right") continue;
		map.set(col.key, { side: "right", offset: `${right}px`, isLast: false });
		right += widthMap?.get(col.key) ?? parseWidth(col.width);
		lastRight = col.key;
	}
	markLast(map, lastRight);

	return map;
}

function markLast(map: Map<string, StickyOffset>, key: string | undefined) {
	if (key === undefined) return;
	const offset = map.get(key);
	if (offset) map.set(key, { ...offset, isLast: true });
}

/** 固定列的 data 属性与内联 left/right；非固定列返回空对象。 */
export function stickyProps(offset: StickyOffset | undefined): StickyProps {
	if (!offset) return {};
	return {
		"data-sticky": offset.side,
		"data-sticky-edge": offset.isLast ? "" : undefined,
		style: offset.side === "left" ? { left: offset.offset } : { right: offset.offset },
	};
}

/** 解析 px 宽度用于偏移累加，非 px 宽度回退为 0 */
function parseWidth(width?: string): number {
	if (!width) return 0;
	const matched = width.match(/^(\d+(?:\.\d+)?)px$/);
	return matched ? Number(matched[1]) : 0;
}
