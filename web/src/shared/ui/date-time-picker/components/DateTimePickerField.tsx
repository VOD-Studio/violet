import { Label } from "@/shared/ui/base/label";
import type { DateTimePickerFieldProps } from "../types/date-time-picker-types";
import { DateTimePicker } from "./DateTimePicker";

/**
 * DateTimePickerField - 带 Label 的日期时间选择器字段
 *
 * 用于表单场景，自动渲染 label、选择器和错误提示。
 */
export function DateTimePickerField({
    id,
    label,
    error,
    ...pickerProps
}: DateTimePickerFieldProps) {
    return (
        <div className="space-y-2">
            <Label htmlFor={id}>{label}</Label>
            <DateTimePicker {...pickerProps} />
            {error && <p className="text-destructive text-sm">{error}</p>}
        </div>
    );
}
