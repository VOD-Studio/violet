/**
 * color-picker - 文字颜色选择器
 *
 * 色板式颜色选择：预设色块网格 + 自定义颜色 input + 清除按钮。
 * 用 DropdownMenu 承载，点击色块即应用。触发器显示当前颜色色点。
 */
import { Baseline, Palette } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";

/** 预设色板：覆盖常用文字色 */
const PRESET_COLORS = [
    "#ef4444", // red-500
    "#f97316", // orange-500
    "#f59e0b", // amber-500
    "#eab308", // yellow-500
    "#84cc16", // lime-500
    "#22c55e", // green-500
    "#10b981", // emerald-500
    "#14b8a6", // teal-500
    "#06b6d4", // cyan-500
    "#0ea5e9", // sky-500
    "#3b82f6", // blue-500
    "#6366f1", // indigo-500
    "#8b5cf6", // violet-500
    "#a855f7", // purple-500
    "#d946ef", // fuchsia-500
    "#ec4899", // pink-500
    "#64748b", // slate-500
    "#0f172a", // slate-900
];

export interface ColorSwatchProps {
    /** 当前颜色值 */
    value?: string;
    /** 应用颜色 */
    onChange: (color: string) => void;
    /** 清除颜色 */
    onClear: () => void;
}

export function ColorSwatch({ value, onChange, onClear }: ColorSwatchProps) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    title="文字颜色"
                    className="relative"
                >
                    <Palette className="size-4" />
                    {/* 底部色条：显示当前颜色 */}
                    <span
                        className={cn(
                            "absolute bottom-1 left-1/2 h-0.5 w-3.5 -translate-x-1/2 rounded-full",
                        )}
                        style={{ backgroundColor: value || "currentColor" }}
                    />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52 p-2">
                <div className="grid grid-cols-6 gap-1.5">
                    {PRESET_COLORS.map((c) => (
                        <button
                            type="button"
                            key={c}
                            onClick={() => onChange(c)}
                            title={c}
                            className={cn(
                                "size-6 rounded-md border transition-transform hover:scale-110",
                                value?.toLowerCase() === c && "ring-2 ring-ring ring-offset-1",
                            )}
                            style={{ backgroundColor: c }}
                        />
                    ))}
                </div>
                <div className="my-2 h-px bg-edge-hairline" />
                {/* 自定义颜色：原生 input[type=color] */}
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-accent">
                    <span
                        className="size-5 rounded border border-edge-hairline"
                        style={{ backgroundColor: value || "#000000" }}
                    />
                    <span>自定义颜色</span>
                    <input
                        type="color"
                        value={value || "#000000"}
                        onChange={(e) => onChange(e.target.value)}
                        className="ml-auto size-7 cursor-pointer rounded border-0 bg-transparent p-0"
                    />
                </label>
                {/* 清除颜色 */}
                <button
                    type="button"
                    onClick={onClear}
                    className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-accent"
                >
                    <Baseline className="size-5" />
                    <span>清除颜色</span>
                </button>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
