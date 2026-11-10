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
}

/**
 * 按尺寸档给出图标的尺寸与线宽。
 *
 * @param size - 尺寸档，省略时取 16（按钮、菜单项、输入框、列表的默认档）
 * @returns 可直接展开的 `{ size, strokeWidth }`
 * @example
 * <CircleAlert {...iconProps(14)} />
 */
export function iconProps(size: IconSize = 16): IconPropsPair {
	return { size, strokeWidth: STROKE_WIDTH[size] };
}
