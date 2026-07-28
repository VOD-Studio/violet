import {
    addMonths,
    format,
    getDay,
    getDaysInMonth,
    isSameDay,
    setMonth as setMonthDate,
    startOfDay,
    startOfMonth,
    startOfToday,
    subMonths,
} from "date-fns";
import { zhCN } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/base/button";
import type { CalendarProps } from "../types/date-time-picker-types";
import { isDateDisabled } from "../utils/date-time-utils";

type CalendarView = "days" | "months" | "years";

const MONTH_LABELS = [
    "1月",
    "2月",
    "3月",
    "4月",
    "5月",
    "6月",
    "7月",
    "8月",
    "9月",
    "10月",
    "11月",
    "12月",
];

/**
 * Calendar - 月视图日期选择面板
 *
 * 基于 date-fns 构建，支持翻月、选中态、今天高亮、禁用日期、年月快速跳转。
 */
export function Calendar({
    selected,
    onSelect,
    month: controlledMonth,
    onMonthChange,
    className,
    disabled,
    minDate,
    maxDate,
    disabledDate,
    weekStartsOn = 1,
    range,
    hoverDate,
    onHoverDateChange,
}: CalendarProps) {
    const today = startOfToday();
    const [internalMonth, setInternalMonth] = React.useState(controlledMonth ?? today);
    const month = controlledMonth ?? internalMonth;
    const [view, setView] = React.useState<CalendarView>("days");
    const [pickerYear, setPickerYear] = React.useState(month.getFullYear());

    const updateMonth = React.useCallback(
        (next: Date) => {
            setInternalMonth(next);
            onMonthChange?.(next);
        },
        [onMonthChange],
    );

    const monthStart = startOfMonth(month);
    const daysInMonth = getDaysInMonth(monthStart);
    const rawStartWeekday = getDay(monthStart); // 0 = Sunday
    const startWeekday = (rawStartWeekday - weekStartsOn + 7) % 7;

    const prevMonth = () => updateMonth(subMonths(month, 1));
    const nextMonth = () => updateMonth(addMonths(month, 1));
    const prevYear = () => setPickerYear((y) => y - 1);
    const nextYear = () => setPickerYear((y) => y + 1);
    const prevYearRange = () => setPickerYear((y) => y - 12);
    const nextYearRange = () => setPickerYear((y) => y + 12);

    const handleSelectDay = (date: Date) => {
        if (disabled) return;
        if (isDateDisabled(date, { minDate, maxDate, disabledDate })) return;
        // 点击非当月补齐日期时自动翻月到该日期所在月份
        if (date.getMonth() !== month.getMonth()) {
            updateMonth(date);
        }
        onSelect?.(date);
    };

    const handleSelectMonth = (monthIndex: number) => {
        if (disabled) return;
        const next = setMonthDate(month, monthIndex);
        updateMonth(next);
        setView("days");
    };

    const handleSelectYear = (year: number) => {
        if (disabled) return;
        setPickerYear(year);
        setView("months");
    };

    const openYearPicker = () => {
        setPickerYear(month.getFullYear());
        setView("years");
    };

    const openMonthPicker = () => {
        setPickerYear(month.getFullYear());
        setView("months");
    };

    // 根据 weekStartsOn 重新排列星期头
    const weekDays = React.useMemo(() => {
        const base = ["日", "一", "二", "三", "四", "五", "六"];
        return [...base.slice(weekStartsOn), ...base.slice(0, weekStartsOn)];
    }, [weekStartsOn]);

    // 生成 6 行 x 7 列 的日期网格（包含上下月补齐日期）
    const cells: Date[] = [];
    const totalCells = 42;
    const prevMonthDays = getDaysInMonth(subMonths(monthStart, 1));

    for (let i = 0; i < totalCells; i++) {
        const offset = i - startWeekday;
        if (offset < 0) {
            cells.push(
                new Date(
                    monthStart.getFullYear(),
                    monthStart.getMonth() - 1,
                    prevMonthDays + offset + 1,
                ),
            );
        } else if (offset < daysInMonth) {
            cells.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), offset + 1));
        } else {
            cells.push(
                new Date(
                    monthStart.getFullYear(),
                    monthStart.getMonth() + 1,
                    offset - daysInMonth + 1,
                ),
            );
        }
    }

    // 年份选择器：以 pickerYear 为中点前后 6 年（共 12 年）
    const yearStart = pickerYear - 5;
    const years = Array.from({ length: 12 }, (_, i) => yearStart + i);

    const isMonthDisabled = (monthIndex: number) => {
        if (!minDate && !maxDate) return false;
        const firstDay = new Date(pickerYear, monthIndex, 1);
        const lastDay = new Date(pickerYear, monthIndex, getDaysInMonth(firstDay));
        if (minDate && lastDay < minDate) return true;
        if (maxDate && firstDay > maxDate) return true;
        return false;
    };

    const isYearDisabled = (year: number) => {
        if (!minDate && !maxDate) return false;
        const firstDay = new Date(year, 0, 1);
        const lastDay = new Date(year, 11, 31);
        if (minDate && lastDay < minDate) return true;
        if (maxDate && firstDay > maxDate) return true;
        return false;
    };

    const isDateInRange = (date: Date, start?: Date | null, end?: Date | null) => {
        if (!start) return false;
        const rangeEnd = end ?? hoverDate;
        if (!rangeEnd) return false;
        const t = startOfDay(date).getTime();
        const s = startOfDay(start).getTime();
        const e = startOfDay(rangeEnd).getTime();
        return t > Math.min(s, e) && t < Math.max(s, e);
    };

    const isRangeEndpoint = (date: Date, endpoint?: Date | null) =>
        endpoint != null && isSameDay(date, endpoint);

    return (
        <div className={cn("w-full", className)}>
            {/* 头部：月份 + 切换 */}
            <div className="mb-2 flex items-center justify-between">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={
                        view === "days" ? prevMonth : view === "months" ? prevYear : prevYearRange
                    }
                    disabled={disabled}
                    aria-label={
                        view === "days" ? "上个月" : view === "months" ? "上一年" : "上一组年份"
                    }
                >
                    <ChevronLeft className="size-4" />
                </Button>
                <div className="flex items-center gap-1">
                    {view === "days" ? (
                        <>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={openYearPicker}
                                disabled={disabled}
                                className="text-sm font-medium"
                            >
                                {format(month, "yyyy年", { locale: zhCN })}
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={openMonthPicker}
                                disabled={disabled}
                                className="text-sm font-medium"
                            >
                                {format(month, "M月", { locale: zhCN })}
                            </Button>
                        </>
                    ) : view === "months" ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={openYearPicker}
                            disabled={disabled}
                            className="text-sm font-medium"
                        >
                            {pickerYear}年
                        </Button>
                    ) : (
                        <span className="text-sm font-medium">
                            {years[0]} - {years[years.length - 1]}
                        </span>
                    )}
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={
                        view === "days" ? nextMonth : view === "months" ? nextYear : nextYearRange
                    }
                    disabled={disabled}
                    aria-label={
                        view === "days" ? "下个月" : view === "months" ? "下一年" : "下一组年份"
                    }
                >
                    <ChevronRight className="size-4" />
                </Button>
            </div>

            {view === "days" && (
                <>
                    {/* 星期头 */}
                    <div className="grid grid-cols-7">
                        {weekDays.map((d) => (
                            <div
                                key={d}
                                className="text-muted-foreground flex h-8 items-center justify-center text-xs font-medium"
                            >
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* 日期网格 */}
                    <div
                        className="grid grid-cols-7"
                        onMouseLeave={() => onHoverDateChange?.(null)}
                    >
                        {cells.map((date, index) => {
                            const current = date.getMonth() === month.getMonth();
                            const isSelected = selected != null && isSameDay(date, selected);
                            const isToday = isSameDay(date, today);
                            const isDisabled = isDateDisabled(date, {
                                minDate,
                                maxDate,
                                disabledDate,
                            });
                            const isRangeStart = isRangeEndpoint(date, range?.start);
                            const isRangeEnd = isRangeEndpoint(date, range?.end);
                            const isRangeSingle = isRangeStart && isRangeEnd;
                            const inRange =
                                !isRangeStart &&
                                !isRangeEnd &&
                                isDateInRange(date, range?.start, range?.end);
                            const isEndpoint =
                                isSelected || isRangeStart || isRangeEnd || isRangeSingle;

                            return (
                                <div
                                    key={index}
                                    data-current={current}
                                    className={cn(
                                        "flex h-8 items-center justify-center",
                                        inRange && "bg-primary/20",
                                        isRangeStart && !isRangeSingle && "rounded-l-md bg-primary",
                                        isRangeEnd && !isRangeSingle && "rounded-r-md bg-primary",
                                        isRangeSingle && "rounded-md bg-primary",
                                        isSelected &&
                                            !isRangeStart &&
                                            !isRangeEnd &&
                                            "rounded-md bg-primary",
                                    )}
                                >
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-xs"
                                        disabled={disabled || isDisabled}
                                        onClick={() => handleSelectDay(date)}
                                        onMouseEnter={() => onHoverDateChange?.(date)}
                                        className={cn(
                                            "size-8 text-xs",
                                            // 非当月补齐日期：淡灰但仍可点（点击自动翻月）
                                            !current && "text-muted-foreground/60",
                                            isToday &&
                                                !isEndpoint &&
                                                !inRange &&
                                                "border border-primary text-primary",
                                            // 禁用日期：删除线 + 更淡 + 禁止指针，与补齐日期明确区分
                                            isDisabled &&
                                                "text-muted-foreground/30 line-through cursor-not-allowed hover:bg-transparent",
                                            isEndpoint &&
                                                "bg-transparent text-primary-foreground hover:bg-transparent hover:text-primary-foreground",
                                            inRange &&
                                                "bg-transparent text-foreground hover:bg-primary/10",
                                        )}
                                    >
                                        {date.getDate()}
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {view === "months" && (
                <div className="grid grid-cols-3 gap-2">
                    {MONTH_LABELS.map((label, index) => {
                        const isSelected =
                            month.getFullYear() === pickerYear && month.getMonth() === index;
                        const isDisabled = isMonthDisabled(index);
                        return (
                            <Button
                                key={label}
                                type="button"
                                variant={isSelected ? "default" : "outline"}
                                size="sm"
                                disabled={disabled || isDisabled}
                                onClick={() => handleSelectMonth(index)}
                                className={cn(
                                    "h-9 text-xs",
                                    isDisabled && "text-muted-foreground/40",
                                )}
                            >
                                {label}
                            </Button>
                        );
                    })}
                </div>
            )}

            {view === "years" && (
                <div className="grid grid-cols-3 gap-2">
                    {years.map((year) => {
                        const isSelected = month.getFullYear() === year;
                        const isDisabled = isYearDisabled(year);
                        return (
                            <Button
                                key={year}
                                type="button"
                                variant={isSelected ? "default" : "outline"}
                                size="sm"
                                disabled={disabled || isDisabled}
                                onClick={() => handleSelectYear(year)}
                                className={cn(
                                    "h-9 text-xs",
                                    isDisabled && "text-muted-foreground/40",
                                )}
                            >
                                {year}
                            </Button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
