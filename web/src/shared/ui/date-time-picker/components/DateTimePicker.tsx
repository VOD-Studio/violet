import { format } from "date-fns";
import { CalendarIcon, Clock } from "lucide-react";
import * as React from "react";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/base/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/base/popover";
import type { DateTimePickerMode, DateTimePickerProps } from "../types/date-time-picker-types";
import { formatPickerValue, formatTime, parsePickerValue } from "../utils/date-time-utils";
import { Calendar } from "./Calendar";
import { TimePicker } from "./TimePicker";

/**
 * DateTimePicker - 日期时间选择器
 *
 * 支持 date / datetime / time 三种模式，通过 Popover 打开日历/时间面板。
 * 输入/输出格式：
 * - date: YYYY-MM-DD
 * - datetime: YYYY-MM-DDTHH:mm
 * - time: HH:mm
 */
export function DateTimePicker({
	value,
	onChange,
	mode = "datetime",
	placeholder,
	disabled,
	className,
	min,
	max,
	disabledDate,
	clearable = true,
	presets,
}: DateTimePickerProps) {
	const [open, setOpen] = React.useState(false);

	const date = React.useMemo(() => parsePickerValue(value || "", mode), [value, mode]);

	const minDate = React.useMemo(() => parsePickerValue(min || "", mode), [min, mode]);
	const maxDate = React.useMemo(() => parsePickerValue(max || "", mode), [max, mode]);

	const displayText = React.useMemo(() => {
		if (!date) {
			// 值无法解析为日期时（如 "never" 这类哨兵串），若匹配某个 preset，
			// 显示该 preset 的 label，避免与空值占位符混淆。
			const matchedPreset = presets?.find((p) => p.value === value);
			if (matchedPreset) return matchedPreset.label;
			return placeholder ?? getDefaultPlaceholder(mode);
		}
		switch (mode) {
			case "date":
				return format(date, "yyyy-MM-dd");
			case "time":
				return format(date, "HH:mm");
			default:
				return format(date, "yyyy-MM-dd HH:mm");
		}
	}, [date, mode, placeholder, presets, value]);

	const handleDateSelect = (nextDate: Date) => {
		if (mode === "time") return;
		if (!date || mode === "date") {
			onChange?.(formatPickerValue(nextDate, mode));
			if (mode === "date") setOpen(false);
			return;
		}
		// datetime 模式保留原时间
		const updated = new Date(
			nextDate.getFullYear(),
			nextDate.getMonth(),
			nextDate.getDate(),
			date.getHours(),
			date.getMinutes(),
		);
		onChange?.(formatPickerValue(updated, mode));
	};

	const handleTimeChange = (time: string) => {
		if (mode === "date") return;
		const baseDate =
			date ?? (mode === "time" ? new Date() : new Date(new Date().toDateString()));
		const [h, m] = time.split(":");
		const updated = new Date(
			baseDate.getFullYear(),
			baseDate.getMonth(),
			baseDate.getDate(),
			Number(h || 0),
			Number(m || 0),
		);
		onChange?.(formatPickerValue(updated, mode));
	};

	const currentTime = date ? formatTime(date) : "00:00";

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					disabled={disabled}
					className={cn(
						"w-full justify-start text-left font-normal",
						!date && "text-muted-foreground",
						className,
					)}
				>
					{mode === "time" ? (
						<Clock className="mr-2 size-4" />
					) : (
						<CalendarIcon className="mr-2 size-4" />
					)}
					{displayText}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-auto min-w-80 p-4" align="start">
				<div className="space-y-4">
					{mode !== "time" && (
						<Calendar
							selected={date}
							onSelect={handleDateSelect}
							minDate={minDate ?? undefined}
							maxDate={maxDate ?? undefined}
							disabledDate={disabledDate}
							weekStartsOn={1}
						/>
					)}

					{mode !== "date" && (
						<div className={mode !== "time" ? "border-t pt-4" : undefined}>
							<TimePicker
								value={currentTime}
								onChange={handleTimeChange}
								disabled={disabled}
							/>
						</div>
					)}

					{presets && presets.length > 0 && (
						<div className="border-t pt-4">
							<div className="text-muted-foreground mb-2 text-xs font-medium">
								快捷选择
							</div>
							<div className="flex flex-wrap gap-2">
								{presets.map((preset) => (
									<Button
										key={preset.value}
										type="button"
										variant="outline"
										size="sm"
										className="h-7 px-2.5 text-xs"
										onClick={() => {
											onChange?.(preset.value);
										}}
									>
										{preset.label}
									</Button>
								))}
							</div>
						</div>
					)}

					<div className="flex justify-end gap-2">
						{clearable && (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => {
									onChange?.("");
									setOpen(false);
								}}
							>
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

function getDefaultPlaceholder(mode: DateTimePickerMode): string {
	switch (mode) {
		case "date":
			return "选择日期";
		case "time":
			return "选择时间";
		default:
			return "选择日期时间";
	}
}
