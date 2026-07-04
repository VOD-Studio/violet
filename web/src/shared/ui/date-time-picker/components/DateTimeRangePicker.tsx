import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/base/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/base/popover";
import type { DateTimeRange, DateTimeRangePickerProps } from "../types/date-time-picker-types";
import {
    combineDateTime,
    formatPickerValue,
    parsePickerValue,
    splitDateTime,
} from "../utils/date-time-utils";
import { Calendar } from "./Calendar";
import { TimePicker } from "./TimePicker";

/**
 * DateTimeRangePicker - 日期时间区间选择器
 *
 * 支持选择开始日期时间和结束日期时间，输出格式为 YYYY-MM-DDTHH:mm。
 * 第一次点击选择开始日期，第二次点击选择结束日期，悬停时提供区间预览。
 * 可通过开始/结束时间选择器分别调整时间部分。
 */
export function DateTimeRangePicker({
    value,
    onChange,
    placeholder,
    disabled,
    className,
    min,
    max,
    disabledDate,
    clearable = true,
    presets,
}: DateTimeRangePickerProps) {
    const [open, setOpen] = React.useState(false);
    const [hoverDate, setHoverDate] = React.useState<Date | null>(null);

    const startDate = React.useMemo(
        () => parsePickerValue(value?.start || "", "datetime"),
        [value?.start],
    );
    const endDate = React.useMemo(
        () => parsePickerValue(value?.end || "", "datetime"),
        [value?.end],
    );
    const minDate = React.useMemo(() => parsePickerValue(min || "", "datetime"), [min]);
    const maxDate = React.useMemo(() => parsePickerValue(max || "", "datetime"), [max]);

    const displayText = React.useMemo(() => {
        if (!startDate && !endDate) return placeholder ?? "选择日期时间区间";
        const startText = startDate ? format(startDate, "yyyy-MM-dd HH:mm") : "";
        const endText = endDate ? format(endDate, "yyyy-MM-dd HH:mm") : "";
        if (startText && endText) return `${startText} 至 ${endText}`;
        return startText || endText;
    }, [startDate, endDate, placeholder]);

    const handleSelectDate = (date: Date) => {
        const selectedStr = formatPickerValue(date, "datetime");

        if (!startDate || (startDate && endDate)) {
            onChange?.({ start: selectedStr, end: undefined });
            return;
        }

        if (date < startDate) {
            onChange?.({
                start: selectedStr,
                end: value?.start,
            });
        } else {
            onChange?.({
                start: value?.start,
                end: selectedStr,
            });
        }
    };

    const handleTimeChange = (endpoint: "start" | "end", time: string) => {
        const currentStr = endpoint === "start" ? value?.start : value?.end;
        if (!currentStr) return;
        const { date } = splitDateTime(currentStr, "datetime");
        if (!date) return;
        const dateStr = formatPickerValue(date, "date");
        const nextStr = combineDateTime(dateStr, time);

        if (endpoint === "start") {
            onChange?.({ start: nextStr, end: value?.end });
        } else {
            onChange?.({ start: value?.start, end: nextStr });
        }
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

    const handlePresetClick = (preset: DateTimeRange) => {
        onChange?.(preset);
        setHoverDate(null);
        setOpen(false);
    };

    const startTime = startDate ? formatPickerValue(startDate, "time") : "00:00";
    const endTime = endDate ? formatPickerValue(endDate, "time") : "00:00";

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
            <PopoverContent className="w-auto p-3" align="start">
                <div className="space-y-3">
                    <Calendar
                        range={{ start: startDate, end: endDate }}
                        hoverDate={hoverDate}
                        onSelect={handleSelectDate}
                        onHoverDateChange={handleHoverDateChange}
                        minDate={minDate ?? undefined}
                        maxDate={maxDate ?? undefined}
                        disabledDate={disabledDate}
                        weekStartsOn={1}
                    />

                    <div className="border-t pt-3">
                        <TimePicker
                            label="开始时间"
                            value={startTime}
                            onChange={(time) => handleTimeChange("start", time)}
                            disabled={disabled || !startDate}
                        />
                        <TimePicker
                            label="结束时间"
                            value={endTime}
                            onChange={(time) => handleTimeChange("end", time)}
                            disabled={disabled || !endDate}
                        />
                    </div>

                    {presets && presets.length > 0 && (
                        <div className="border-t pt-3">
                            <div className="text-muted-foreground mb-2 text-xs">快捷选择</div>
                            <div className="flex flex-wrap gap-2">
                                {presets.map((preset) => (
                                    <Button
                                        key={preset.label}
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handlePresetClick(preset.value)}
                                    >
                                        {preset.label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}

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
