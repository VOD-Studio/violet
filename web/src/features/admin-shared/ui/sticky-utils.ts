import type { CSSProperties } from "react";
import type { DataTableColumn } from "./data-table-types";

/** 固定列偏移信息 */
export interface StickyOffset {
	side: "left" | "right";
	/** 累积偏移，如 "120px" */
	offset: string;
	/** 是否为该侧最后一个固定列（需要显示阴影） */
	isLast: boolean;
}

/** 固定列的样式（类名 + 内联 style） */
export interface StickyStyle {
	className: string;
	style?: CSSProperties;
}

/**
 * 固定列与滚动列交界处的分隔投影。
 *
 * 使用伪元素实现阴影，确保阴影层级在最上面，不会被非固定列覆盖。
 * 左侧固定列：在最后一个左固定列的右侧显示阴影；
 * 右侧固定列：在第一个右固定列的左侧显示阴影。
 *
 * after:absolute + after:top-0 + after:bottom-0 创建全高阴影层
 * after:w-[10px] 设置阴影宽度
 * after:shadow-[...] 定义阴影效果
 * after:pointer-events-none 确保不影响交互
 */
const LEFT_SHADOW = "after:absolute after:top-0 after:bottom-0 after:right-0 after:w-[10px] after:translate-x-full after:shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.15)] after:pointer-events-none";
const RIGHT_SHADOW = "before:absolute before:top-0 before:bottom-0 before:left-0 before:w-[10px] before:-translate-x-full before:shadow-[8px_0_8px_-8px_rgba(0,0,0,0.15)] before:pointer-events-none";

/**
 * 预计算固定列的左右偏移，同侧多列按宽度累加。
 *
 * 仅 px 宽度可精确累加；非 px（如 "20%"）回退 0。
 * 标记每侧最后一个固定列，用于显示阴影。
 */
export function computeStickyOffsets<T>(columns: DataTableColumn<T>[]): Map<string, StickyOffset> {
	const map = new Map<string, StickyOffset>();

	// 收集左侧固定列
	const leftSticky: DataTableColumn<T>[] = [];
	let left = 0;
	for (const col of columns) {
		if (col.sticky === "left") {
			leftSticky.push(col);
			map.set(col.key, { side: "left", offset: `${left}px`, isLast: false });
			left += parseWidth(col.width);
		}
	}
	// 标记最后一个左固定列
	if (leftSticky.length > 0) {
		const lastLeft = leftSticky[leftSticky.length - 1];
		const existing = map.get(lastLeft.key);
		if (existing) {
			map.set(lastLeft.key, { ...existing, isLast: true });
		}
	}

	// 收集右侧固定列
	const rightSticky: DataTableColumn<T>[] = [];
	let right = 0;
	for (let i = columns.length - 1; i >= 0; i -= 1) {
		const col = columns[i];
		if (col?.sticky === "right") {
			rightSticky.push(col);
			map.set(col.key, { side: "right", offset: `${right}px`, isLast: false });
			right += parseWidth(col.width);
		}
	}
	// 标记第一个右固定列（从右往左最后一个）
	if (rightSticky.length > 0) {
		const lastRight = rightSticky[rightSticky.length - 1];
		const existing = map.get(lastRight.key);
		if (existing) {
			map.set(lastRight.key, { ...existing, isLast: true });
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
 * z 轴分层（高→低）：吸顶且固定 z-50 > 吸顶 z-30 > 固定 z-40 > 普通 z-0。
 * 固定列背景强制不透明，避免横向滚动时穿透。
 * 只在最后一个固定列显示阴影（通过伪元素实现）。
 */
export function headStickyStyle(
	offset: StickyOffset | undefined,
	stickyHeader?: boolean,
): StickyStyle {
	const classes: string[] = [];

	if (stickyHeader && offset) {
		classes.push(
			"sticky",
			"z-50",
			"top-0",
			"bg-background",
			"relative", // 需要 relative 才能定位伪元素
		);
		// 只在最后一个固定列显示阴影
		if (offset.isLast) {
			classes.push(offset.side === "left" ? LEFT_SHADOW : RIGHT_SHADOW);
		}
	} else if (stickyHeader) {
		classes.push("sticky", "z-30", "top-0", "bg-background");
	} else if (offset) {
		classes.push(
			"sticky",
			"z-40",
			"bg-background",
			"relative", // 需要 relative 才能定位伪元素
		);
		// 只在最后一个固定列显示阴影
		if (offset.isLast) {
			classes.push(offset.side === "left" ? LEFT_SHADOW : RIGHT_SHADOW);
		}
	} else {
		classes.push("z-0");
	}

	return { className: classes.join(" ") };
}

/**
 * 数据单元格的固定列样式。
 *
 * 固定单元格 sticky + z-40 + 不透明 bg-card；普通单元格不定位（static），
 * 不创建独立 stacking context，保证 sticky 固定列自然盖在其上。
 * 只在最后一个固定列显示阴影（通过伪元素实现）。
 */
export function cellStickyStyle(offset: StickyOffset | undefined): StickyStyle {
	if (!offset) return { className: "" };
	const classes = [
		"sticky",
		"z-40",
		"bg-card",
		"relative", // 需要 relative 才能定位伪元素
	];
	// 只在最后一个固定列显示阴影
	if (offset.isLast) {
		classes.push(offset.side === "left" ? LEFT_SHADOW : RIGHT_SHADOW);
	}
	return {
		className: classes.join(" "),
	};
}

/** 解析 px 宽度用于偏移累加，非 px 宽度回退为 0 */
function parseWidth(width?: string): number {
	if (!width) return 0;
	const matched = width.match(/^(\d+(?:\.\d+)?)px$/);
	return matched ? Number(matched[1]) : 0;
}
