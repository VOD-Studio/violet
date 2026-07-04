import { Clock } from "lucide-react";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/base/select";
import type { TimePickerProps } from "../types/date-time-picker-types";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

/**
 * TimePicker - 时间选择器
 *
 * 提供小时和分钟两个下拉选择。
 */
export function TimePicker({ value = "00:00", onChange, disabled }: TimePickerProps) {
    const [hour, minute] = value.split(":");

    const handleChange = (part: "hour" | "minute", next: string) => {
        const h = part === "hour" ? next : hour || "00";
        const m = part === "minute" ? next : minute || "00";
        onChange?.(`${h}:${m}`);
    };

    return (
        <div className="flex items-center gap-2">
            <Clock className="text-muted-foreground size-4" />
            <span className="text-sm font-medium">时间</span>
            <div className="ml-auto flex items-center gap-2">
                <Select
                    value={hour || "00"}
                    onValueChange={(v) => handleChange("hour", v)}
                    disabled={disabled}
                >
                    <SelectTrigger className="h-8 w-20">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                        {HOURS.map((h) => (
                            <SelectItem key={h} value={h}>
                                {h}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <span className="text-muted-foreground">:</span>
                <Select
                    value={minute || "00"}
                    onValueChange={(v) => handleChange("minute", v)}
                    disabled={disabled}
                >
                    <SelectTrigger className="h-8 w-20">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                        {MINUTES.map((m) => (
                            <SelectItem key={m} value={m}>
                                {m}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
