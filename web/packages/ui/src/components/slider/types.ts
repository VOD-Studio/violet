import type { Slider as SliderPrimitive } from "radix-ui";
import type { ComponentPropsWithoutRef } from "react";

/** 一个可吸附的刻度及其可见名称。 */
export interface SliderMark {
	value: number;
	label: string;
}

/** 单值或不交叉区间滑块；值数组按起点、终点顺序排列。 */
export interface SliderProps
	extends Omit<
		ComponentPropsWithoutRef<typeof SliderPrimitive.Root>,
		"asChild" | "children" | "orientation" | "inverted" | "minStepsBetweenThumbs"
	> {
	/** 给出刻度时只允许停在刻度上，包括不等距刻度。 */
	marks?: readonly SliderMark[];
	/** 区间的两个滑钮分别命名，默认起点与终点。 */
	thumbLabels?: readonly string[];
	/** 同时用于浮出的值和 aria-valuetext，单位应写在这里。 */
	formatValue?: (value: number, index: number) => string;
	readOnly?: boolean;
	invalid?: boolean;
}
