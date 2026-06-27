import type { CSSProperties } from "react";
import type { DataTableColumn } from "./data-table-types";

/** 固定列偏移信息 */
export interface StickyOffset {
	side: "left" | "right";
	/** 累积偏移，如 "120px" */
	offset: string;
	/** 是否为该侧最后一个固定列（需要显示阴影） */
	isLast: boolean;
	/** 是否显示阴影（根据滚动状态动态计算） */
	showShadow?: boolean;
}

/** 固定列的样式（类名 + 内联 style） */
export interface StickyStyle {
	className: string;
	style?: CSSProperties;
}

/**
 * 固定列阴影类名
 *
 * 使用独立的 CSS 文件定义伪元素，参考 Ant Design 实现
 */
const LEFT_SHADOW = "sticky-shadow-left";
const RIGHT_SHADOW = "sticky-shadow-right";

/**
 * 预计算固定列的左右偏移，同侧多列按宽度累加。
 *
 * 优先使用 widthMap 中的实际宽度（包含拖拽调整后的值），
 * 回退到 col.width 字符串解析。
 * 标记每侧最后一个固定列，用于显示阴影。
 */
export function computeStickyOffsets<T>(
	columns: DataTableColumn<T>[],
	widthMap?: Map<string, number>,
): Map<string, StickyOffset> {
	const map = new Map<string, StickyOffset>();

	// 收集左侧固定列
	const leftSticky: DataTableColumn<T>[] = [];
	let left = 0;
	for (const col of columns) {
		if (col.sticky === "left") {
			leftSticky.push(col);
			map.set(col.key, { side: "left", offset: `${left}px`, isLast: false });
			// 优先使用 widthMap 中的实际宽度
			const width = widthMap?.get(col.key) ?? parseWidth(col.width);
			left += width;
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
			// 优先使用 widthMap 中的实际宽度
			const width = widthMap?.get(col.key) ?? parseWidth(col.width);
			right += width;
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
 * 只在最后一个固定列且滚动时显示阴影（通过 CSS 类名 + 伪元素实现）。
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
		);
		// 只在最后一个固定列且需要显示阴影时添加类名
		if (offset.isLast && offset.showShadow) {
			classes.push(offset.side === "left" ? LEFT_SHADOW : RIGHT_SHADOW);
		}
	} else if (stickyHeader) {
		classes.push("sticky", "z-30", "top-0", "bg-background");
	} else if (offset) {
		classes.push(
			"sticky",
			"z-40",
			"bg-background",
		);
		// 只在最后一个固定列且需要显示阴影时添加类名
		if (offset.isLast && offset.showShadow) {
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
 * 只在最后一个固定列且滚动时显示阴影（通过 CSS 类名 + 伪元素实现）。
 */
export function cellStickyStyle(offset: StickyOffset | undefined): StickyStyle {
	if (!offset) return { className: "" };
	const classes = [
		"sticky",
		"z-40",
		"bg-card",
	];
	// 只在最后一个固定列且需要显示阴影时添加类名
	if (offset.isLast && offset.showShadow) {
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
