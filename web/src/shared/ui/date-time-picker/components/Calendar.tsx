import {
    addMonths,
    format,
    getDay,
    getDaysInMonth,
    isSameDay,
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

const WEEK_DAYS = ["日", "一", "二", "三", "四", "五", "六"];

/**
 * Calendar - 月视图日期选择面板
 *
 * 基于 date-fns 构建，支持翻月、选中态、今天高亮、禁用日期。
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
}: CalendarProps) {
    const today = startOfToday();
    const [internalMonth, setInternalMonth] = React.useState(controlledMonth ?? today);
    const month = controlledMonth ?? internalMonth;

    const setMonth = React.useCallback(
        (next: Date) => {
            setInternalMonth(next);
            onMonthChange?.(next);
        },
        [onMonthChange],
    );

    const monthStart = startOfMonth(month);
    const daysInMonth = getDaysInMonth(monthStart);
    const startWeekday = getDay(monthStart); // 0 = Sunday

    const prevMonth = () => setMonth(subMonths(month, 1));
    const nextMonth = () => setMonth(addMonths(month, 1));

    const handleSelect = (day: number, current: boolean) => {
        if (disabled || !current) return;
        const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
        if (isDateDisabled(date, { minDate, maxDate, disabledDate })) return;
        onSelect?.(date);
    };

    // 生成 6 行 x 7 列 的日期网格（包含上下月补齐日期）
    const cells: { day: number; current: boolean }[] = [];
    const totalCells = 42;
    const prevMonthDays = getDaysInMonth(subMonths(monthStart, 1));

    for (let i = 0; i < totalCells; i++) {
        const offset = i - startWeekday;
        if (offset < 0) {
            cells.push({ day: prevMonthDays + offset + 1, current: false });
        } else if (offset < daysInMonth) {
            cells.push({ day: offset + 1, current: true });
        } else {
            cells.push({ day: offset - daysInMonth + 1, current: false });
        }
    }

    return (
        <div className={cn("w-full", className)}>
            {/* 头部：月份 + 切换 */}
            <div className="mb-2 flex items-center justify-between">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={prevMonth}
                    disabled={disabled}
                    aria-label="上个月"
                >
                    <ChevronLeft className="size-4" />
                </Button>
                <span className="text-sm font-medium">
                    {format(month, "yyyy年 M月", { locale: zhCN })}
                </span>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={nextMonth}
                    disabled={disabled}
                    aria-label="下个月"
                >
                    <ChevronRight className="size-4" />
                </Button>
            </div>

            {/* 星期头 */}
            <div className="grid grid-cols-7">
                {WEEK_DAYS.map((d) => (
                    <div
                        key={d}
                        className="text-muted-foreground flex h-8 items-center justify-center text-xs font-medium"
                    >
                        {d}
                    </div>
                ))}
            </div>

            {/* 日期网格 */}
            <div className="grid grid-cols-7 gap-1">
                {cells.map(({ day, current }, index) => {
                    const date = current
                        ? new Date(monthStart.getFullYear(), monthStart.getMonth(), day)
                        : null;
                    const isSelected =
                        date != null && selected != null && isSameDay(date, selected);
                    const isToday = date != null && isSameDay(date, today);
                    const isDisabled =
                        date != null && isDateDisabled(date, { minDate, maxDate, disabledDate });

                    return (
                        <Button
                            key={index}
                            type="button"
                            variant={isSelected ? "default" : "ghost"}
                            size="icon-xs"
                            disabled={disabled || !current || isDisabled}
                            onClick={() => handleSelect(day, current)}
                            className={cn(
                                "size-8 text-xs",
                                !current && "text-muted-foreground/50",
                                isToday && !isSelected && "border border-primary text-primary",
                                isDisabled && "text-muted-foreground/40",
                            )}
                        >
                            {day}
                        </Button>
                    );
                })}
            </div>
        </div>
    );
}
