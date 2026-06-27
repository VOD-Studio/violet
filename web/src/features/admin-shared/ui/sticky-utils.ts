import type { CSSProperties } from "react";
import type { DataTableColumn } from "./data-table-types";

/** 固定列偏移信息 */
export interface StickyOffset {
	side: "left" | "right";
	/** 累积偏移，如 "120px" */
	offset: string;
}

/** 固定列的样式（类名 + 内联 style） */
export interface StickyStyle {
	className: string;
	style?: CSSProperties;
}

/** 左/右固定列朝滚动方向的边缘投影 */
const LEFT_SHADOW = "shadow-[inset_-8px_0_8px_-8px_rgba(0,0,0,0.08)]";
const RIGHT_SHADOW = "shadow-[inset_8px_0_8px_-8px_rgba(0,0,0,0.08)]";

/**
 * 预计算固定列的左右偏移，同侧多列按宽度累加。
 *
 * 仅 px 宽度可精确累加；非 px（如 "20%"）回退 0。
 */
export function computeStickyOffsets<T>(columns: DataTableColumn<T>[]): Map<string, StickyOffset> {
	const map = new Map<string, StickyOffset>();

	let left = 0;
	for (const col of columns) {
		if (col.sticky === "left") {
			map.set(col.key, { side: "left", offset: `${left}px` });
			left += parseWidth(col.width);
		}
	}

	let right = 0;
	for (let i = columns.length - 1; i >= 0; i -= 1) {
		const col = columns[i];
		if (col?.sticky === "right") {
			map.set(col.key, { side: "right", offset: `${right}px` });
			right += parseWidth(col.width);
		}
	}

	return map;
}

/** 合并固定列内联偏移与列宽 */
export function mergeStickyStyle(
	offset: StickyOffset | undefined,
	width?: string,
): CSSProperties | undefined {
	const style: CSSProperties = {};
	if (offset) {
		if (offset.side === "left") style.left = offset.offset;
		else style.right = offset.offset;
	}
	if (width) style.width = width;
	return Object.keys(style).length > 0 ? style : undefined;
}

/**
 * 表头单元格的固定列 + 吸顶样式。
 *
 * z 轴分层（高→低）：吸顶且固定 z-40 > 吸顶 z-30 > 固定 z-20 > 普通 z-0。
 * 固定列背景强制不透明，避免横向滚动时穿透。
 */
export function headStickyStyle(
	offset: StickyOffset | undefined,
	stickyHeader?: boolean,
): StickyStyle {
	const classes: string[] = [];

	if (stickyHeader && offset) {
		classes.push(
			"sticky",
			"z-40",
			"top-0",
			"bg-background",
			offset.side === "left" ? LEFT_SHADOW : RIGHT_SHADOW,
		);
	} else if (stickyHeader) {
		classes.push("sticky", "z-30", "top-0", "bg-background");
	} else if (offset) {
		classes.push(
			"sticky",
			"z-20",
			"bg-background",
			offset.side === "left" ? LEFT_SHADOW : RIGHT_SHADOW,
		);
	} else {
		classes.push("relative", "z-0");
	}

	return { className: classes.join(" ") };
}

/**
 * 数据单元格的固定列样式。
 *
 * 固定单元格 z-20 + 不透明 bg-card，普通单元格 z-0，
 * 保证横向滚动时固定列盖在普通列之上。
 */
export function cellStickyStyle(offset: StickyOffset | undefined): StickyStyle {
	if (!offset) return { className: "relative z-0" };
	return {
		className: [
			"sticky",
			"z-20",
			"bg-card",
			offset.side === "left" ? LEFT_SHADOW : RIGHT_SHADOW,
		].join(" "),
	};
}

/** 解析 px 宽度用于偏移累加，非 px 宽度回退为 0 */
function parseWidth(width?: string): number {
	if (!width) return 0;
	const matched = width.match(/^(\d+(?:\.\d+)?)px$/);
	return matched ? Number(matched[1]) : 0;
}
