import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/base/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/base/popover";
import type { DateRangePickerProps } from "../types/date-time-picker-types";
import { formatPickerValue, parsePickerValue } from "../utils/date-time-utils";
import { Calendar } from "./Calendar";

/**
 * DateRangePicker - 日期区间选择器
 *
 * 支持选择开始日期和结束日期，输出格式为 YYYY-MM-DD。
 * 第一次点击选择开始日期，第二次点击选择结束日期，悬停时提供区间预览。
 */
export function DateRangePicker({
    value,
    onChange,
    placeholder,
    disabled,
    className,
    min,
    max,
    disabledDate,
    clearable = true,
}: DateRangePickerProps) {
    const [open, setOpen] = React.useState(false);
    const [hoverDate, setHoverDate] = React.useState<Date | null>(null);

    const startDate = React.useMemo(
        () => parsePickerValue(value?.start || "", "date"),
        [value?.start],
    );
    const endDate = React.useMemo(() => parsePickerValue(value?.end || "", "date"), [value?.end]);
    const minDate = React.useMemo(() => parsePickerValue(min || "", "date"), [min]);
    const maxDate = React.useMemo(() => parsePickerValue(max || "", "date"), [max]);

    const displayText = React.useMemo(() => {
        if (!startDate && !endDate) return placeholder ?? "选择日期区间";
        const startText = startDate ? format(startDate, "yyyy-MM-dd") : "";
        const endText = endDate ? format(endDate, "yyyy-MM-dd") : "";
        if (startText && endText) return `${startText} 至 ${endText}`;
        return startText || endText;
    }, [startDate, endDate, placeholder]);

    const handleSelect = (date: Date) => {
        const selectedStr = formatPickerValue(date, "date");

        if (!startDate || (startDate && endDate)) {
            // 无开始或区间已完整，重新开始选择
            onChange?.({ start: selectedStr, end: undefined });
            return;
        }

        // 已有开始，未选择结束
        if (date < startDate) {
            onChange?.({
                start: selectedStr,
                end: formatPickerValue(startDate, "date"),
            });
        } else {
            onChange?.({
                start: value?.start,
                end: selectedStr,
            });
        }
        setOpen(false);
        setHoverDate(null);
    };

    const handleClear = () => {
        onChange?.({ start: undefined, end: undefined });
        setHoverDate(null);
        setOpen(false);
    };

    const handleHoverDateChange = (date: Date | null) => {
        if (startDate && !endDate) {
            setHoverDate(date);
        }
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && !endDate && "text-muted-foreground",
                        className,
                    )}
                >
                    <CalendarIcon className="mr-2 size-4" />
                    {displayText}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto min-w-[320px] p-4" align="start">
                <div className="space-y-4">
                    <Calendar
                        range={{ start: startDate, end: endDate }}
                        hoverDate={hoverDate}
                        onSelect={handleSelect}
                        onHoverDateChange={handleHoverDateChange}
                        minDate={minDate ?? undefined}
                        maxDate={maxDate ?? undefined}
                        disabledDate={disabledDate}
                        weekStartsOn={1}
                    />

                    <div className="flex justify-end gap-2">
                        {clearable && (
                            <Button type="button" variant="ghost" size="sm" onClick={handleClear}>
                                清除
                            </Button>
                        )}
                        <Button type="button" size="sm" onClick={() => setOpen(false)}>
                            确定
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
