import type { ComponentProps, Ref } from "react";
import type { InputClassNames, InputProps } from "../input";

/** 本地日期、日期时间或时分，不做 UTC 转换。 */
export type DatePickerMode = "date" | "datetime" | "time";

/** 空端点表示开放区间。 */
export interface DateRange {
	start?: string;
	end?: string;
}

/** 快捷值使用当前 mode 对应的格式；空字符串表示清空。 */
export interface DatePickerPreset {
	label: string;
	value: string;
}

/** 范围预设可以只提供一个端点。 */
export interface DateRangePreset {
	label: string;
	value: DateRange;
}

/** 原生属性落在文本输入；onChange 只报告提交后的规范值。 */
export interface DatePickerProps
	extends Omit<
		InputProps,
		| "value"
		| "defaultValue"
		| "onChange"
		| "type"
		| "min"
		| "max"
		| "leading"
		| "trailing"
		| "onClear"
		| "loading"
		| "copyable"
		| "passwordToggle"
	> {
	value?: string;
	defaultValue?: string;
	onChange?: (value: string) => void;
	mode?: DatePickerMode;
	min?: string;
	max?: string;
	disabledDate?: (date: Date) => boolean;
	presets?: readonly DatePickerPreset[];
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	container?: HTMLElement | null;
	collisionBoundary?: Element | null;
}

/** 两个原生输入共用一个 Input 外壳；ref/id/className 属于起点输入。 */
export interface DateRangePickerProps
	extends Omit<DatePickerProps, "value" | "defaultValue" | "onChange" | "mode" | "presets"> {
	value?: DateRange;
	defaultValue?: DateRange;
	onChange?: (value: DateRange) => void;
	mode?: "date" | "datetime";
	/** 不传时提供今天、最近 7/30 天、本月、上个月；传 [] 隐藏。 */
	presets?: readonly DateRangePreset[];
	startName?: string;
	endName?: string;
	/** 默认允许只有一个端点；required 时始终要求两个端点。 */
	allowOpenEnded?: boolean;
	endInputProps?: Omit<
		ComponentProps<"input">,
		| "value"
		| "defaultValue"
		| "onChange"
		| "type"
		| "name"
		| "disabled"
		| "readOnly"
		| "required"
		| "form"
	>;
}

export interface DateTriggerProps {
	inputProps: ComponentProps<"input">;
	endInputProps?: ComponentProps<"input">;
	anchorRef: Ref<HTMLDivElement>;
	variant?: InputProps["variant"];
	controlSize?: InputProps["controlSize"];
	classNames?: InputClassNames;
	invalid?: boolean;
	valid?: boolean;
	clearable?: boolean;
	clearLabel?: string;
	onClear: () => void;
	onOpen: () => void;
	mode: DatePickerMode;
	hasValue: boolean;
	/** 范围触发器当前正在编辑的端点；单值触发器不传。 */
	endpoint?: "start" | "end";
	/** 面板是否展开：展开时当前端点的纸片保持显示。 */
	open?: boolean;
}
