import type { CSSProperties } from "react";

/** 图标尺寸档，每档对应一类放置位置。 */
export type IconSize = 12 | 14 | 16 | 18 | 20 | 24;

/** 尺寸档到线宽的映射：14 及以下加粗到 2，免得太细；其余 1.75。 */
const STROKE_WIDTH: Record<IconSize, number> = {
	12: 2,
	14: 2,
	16: 1.75,
	18: 1.75,
	20: 1.75,
	24: 1.75,
};

/** 图标尺寸与线宽，可直接展开到 lucide 组件或自绘图标上。 */
export interface IconPropsPair {
	size: IconSize;
	strokeWidth: number;
	/** 显式几何优先于按钮、输入框等容器提供的默认图标样式。 */
	style: Pick<CSSProperties, "width" | "height" | "strokeWidth">;
}

/**
 * 按尺寸档给出图标的尺寸与线宽。
 *
 * @param size - 尺寸档，省略时取 16（按钮、菜单项、输入框、列表的默认档）
 * @returns SVG 属性与同值样式，保留显式尺寸和线宽，不受容器默认值覆盖
 * @example
 * <CircleAlert {...iconProps(14)} />
 */
export function iconProps(size: IconSize = 16): IconPropsPair {
	const strokeWidth = STROKE_WIDTH[size];
	return { size, strokeWidth, style: { width: size, height: size, strokeWidth } };
}
