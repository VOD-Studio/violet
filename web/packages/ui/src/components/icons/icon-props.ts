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

/** 显式图标档位；`v-icon` 标记让控件槽保留图标自身的尺寸与线宽。 */
export interface IconProps {
	/** 图标的宽高，单位为 CSS 像素。 */
	size: IconSize;
	strokeWidth: number;
	/** 包含 `v-icon` 标记与调用方附加的类名。 */
	className: string;
}

/**
 * 给 lucide 或自绘图标指定尺寸档，并跳过控件槽的默认尺寸与线宽。
 *
 * @param size - 12 / 14 档使用线宽 2，其余档使用 1.75。
 * @param className - 与 `v-icon` 标记合并；不要在展开返回值后另写 `className` 覆盖标记。
 * @default size 省略时取 16
 * @returns 可直接展开到图标上的尺寸、线宽与类名。
 * @example
 * <CircleAlert {...iconProps(14, "text-destructive")} />
 */
export function iconProps(size: IconSize = 16, className?: string): IconProps {
	return {
		size,
		strokeWidth: STROKE_WIDTH[size],
		className: className ? `v-icon ${className}` : "v-icon",
	};
}
