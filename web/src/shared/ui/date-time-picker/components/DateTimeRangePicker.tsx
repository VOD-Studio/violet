import { format } from "date-fns";
import { CalendarIcon, Clock } from "lucide-react";
import * as React from "react";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/base/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/base/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/ui/base/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui/base/tooltip";
import type { DateTimeRange, DateTimeRangePickerProps } from "../types/date-time-picker-types";
import {
	combineDateTime,
	formatPickerValue,
	parsePickerValue,
	splitDateTime,
} from "../utils/date-time-utils";
import { Calendar } from "./Calendar";

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
			<TooltipProvider>
				<Tooltip>
					<PopoverTrigger asChild>
						<TooltipTrigger asChild>
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
								<CalendarIcon className="size-4 shrink-0" />
								<span className="truncate">{displayText}</span>
							</Button>
						</TooltipTrigger>
					</PopoverTrigger>
					<TooltipContent className="max-w-xs">{displayText}</TooltipContent>
				</Tooltip>
			</TooltipProvider>
			<PopoverContent className="w-auto min-w-80 p-4" align="start">
				<div className="space-y-4">
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

					<div className="border-t pt-4 grid grid-cols-2 gap-3">
						<RangeTimeInput
							label="开始时间"
							value={startTime}
							onChange={(time) => handleTimeChange("start", time)}
							disabled={disabled || !startDate}
						/>
						<RangeTimeInput
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

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

interface RangeTimeInputProps {
	label: string;
	value?: string;
	onChange?: (time: string) => void;
	disabled?: boolean;
}

function RangeTimeInput({ label, value = "00:00", onChange, disabled }: RangeTimeInputProps) {
	const [hour, minute] = value.split(":");

	const handleChange = (part: "hour" | "minute", next: string) => {
		const h = part === "hour" ? next : hour || "00";
		const m = part === "minute" ? next : minute || "00";
		onChange?.(`${h}:${m}`);
	};

	return (
		<div className="w-full space-y-1">
			<div className="text-muted-foreground flex items-center gap-1 text-xs">
				<Clock className="size-3" />
				{label}
			</div>
			<div className="flex w-full items-center gap-1">
				<Select
					value={hour || "00"}
					onValueChange={(v) => handleChange("hour", v)}
					disabled={disabled}
				>
					<SelectTrigger className="h-8 flex-1 px-2 text-xs">
						<SelectValue />
					</SelectTrigger>
					<SelectContent className="max-h-60">
						{HOURS.map((h) => (
							<SelectItem key={h} value={h} className="text-xs">
								{h}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<span className="text-muted-foreground text-sm">:</span>
				<Select
					value={minute || "00"}
					onValueChange={(v) => handleChange("minute", v)}
					disabled={disabled}
				>
					<SelectTrigger className="h-8 flex-1 px-2 text-xs">
						<SelectValue />
					</SelectTrigger>
					<SelectContent className="max-h-60">
						{MINUTES.map((m) => (
							<SelectItem key={m} value={m} className="text-xs">
								{m}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</div>
	);
}
