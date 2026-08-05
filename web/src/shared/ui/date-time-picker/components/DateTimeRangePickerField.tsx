import { Label } from "@/shared/ui/base/label";
import type { DateTimeRangePickerFieldProps } from "../types/date-time-picker-types";
import { DateTimeRangePicker } from "./DateTimeRangePicker";

/**
 * DateTimeRangePickerField - 带 Label 的日期时间区间选择器字段
 *
 * 用于表单场景，自动渲染 label、选择器和错误提示。
 */
export function DateTimeRangePickerField({
	id,
	label,
	error,
	...pickerProps
}: DateTimeRangePickerFieldProps) {
	return (
		<div className="space-y-2">
			<Label htmlFor={id}>{label}</Label>
			<DateTimeRangePicker {...pickerProps} />
			{error && <p className="text-destructive text-sm">{error}</p>}
		</div>
	);
}
