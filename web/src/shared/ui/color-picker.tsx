/**
 * color-picker - 文字颜色选择器
 *
 * 色板式颜色选择：预设色块网格 + 自定义 HSV 选色器（饱和度/明度面板 + 色相条）+ 清除。
 * 自定义选色器不依赖原生 input[type=color]，自绘指针交互。
 */

import { Baseline, Palette } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/base/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/shared/ui/base/dropdown-menu";

/** 预设色板 */
const PRESET_COLORS = [
    "#ef4444",
    "#f97316",
    "#f59e0b",
    "#eab308",
    "#84cc16",
    "#22c55e",
    "#10b981",
    "#14b8a6",
    "#06b6d4",
    "#0ea5e9",
    "#3b82f6",
    "#6366f1",
    "#8b5cf6",
    "#a855f7",
    "#d946ef",
    "#ec4899",
    "#64748b",
    "#0f172a",
];

export interface ColorSwatchProps {
    value?: string;
    onChange: (color: string) => void;
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
                    <span
                        className="absolute bottom-1 left-1/2 h-0.5 w-3.5 -translate-x-1/2 rounded-full"
                        style={{ backgroundColor: value || "currentColor" }}
                    />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60 p-3">
                {/* 预设色板 */}
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
                <div className="my-3 h-px bg-edge-hairline" />
                {/* 自定义 HSV 选色器 */}
                <CustomColorPicker value={value || "#3b82f6"} onChange={onChange} />
                <div className="my-3 h-px bg-edge-hairline" />
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

/* —————— 自定义 HSV 选色器 —————— */

interface CustomColorPickerProps {
    value: string;
    onChange: (hex: string) => void;
}

function CustomColorPicker({ value, onChange }: CustomColorPickerProps) {
    const [hsv, setHsv] = useState(() => hexToHsv(value));
    const svRef = useRef<HTMLDivElement>(null);
    const hueRef = useRef<HTMLDivElement>(null);

    // 外部 value 变化时同步（如点预设色）
    useEffect(() => {
        setHsv(hexToHsv(value));
    }, [value]);

    const commit = (next: { h: number; s: number; v: number }) => {
        setHsv(next);
        onChange(hsvToHex(next.h, next.s, next.v));
    };

    // 饱和度/明度面板指针拖动
    const handleSVPointer = (e: React.PointerEvent) => {
        const el = svRef.current;
        if (!el) return;
        el.setPointerCapture(e.pointerId);
        const move = (clientX: number, clientY: number) => {
            const rect = el.getBoundingClientRect();
            const s = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
            const v = Math.min(1, Math.max(0, 1 - (clientY - rect.top) / rect.height));
            commit({ h: hsv.h, s, v });
        };
        move(e.clientX, e.clientY);
        const onMove = (ev: PointerEvent) => move(ev.clientX, ev.clientY);
        const onUp = () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
    };

    // 色相条指针拖动
    const handleHuePointer = (e: React.PointerEvent) => {
        const el = hueRef.current;
        if (!el) return;
        el.setPointerCapture(e.pointerId);
        const move = (clientX: number) => {
            const rect = el.getBoundingClientRect();
            const h = Math.min(360, Math.max(0, ((clientX - rect.left) / rect.width) * 360));
            commit({ h, s: hsv.s, v: hsv.v });
        };
        move(e.clientX);
        const onMove = (ev: PointerEvent) => move(ev.clientX);
        const onUp = () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
    };

    const currentHex = hsvToHex(hsv.h, hsv.s, hsv.v);

    return (
        <div className="space-y-2">
            {/* SV 面板：背景为当前色相纯色，叠加白→黑渐变模拟 S/V */}
            <div
                ref={svRef}
                onPointerDown={handleSVPointer}
                className="relative h-28 w-full cursor-crosshair rounded-md overflow-hidden touch-none"
                style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)` }}
            >
                {/* 白色横向渐变（饱和度）*/}
                <div className="absolute inset-0 bg-gradient-to-r from-white to-transparent" />
                {/* 黑色纵向渐变（明度）*/}
                <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
                {/* 指针 */}
                <div
                    className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
                    style={{
                        left: `${hsv.s * 100}%`,
                        top: `${(1 - hsv.v) * 100}%`,
                    }}
                />
            </div>
            {/* 色相条 */}
            <div
                ref={hueRef}
                onPointerDown={handleHuePointer}
                className="relative h-3 w-full cursor-pointer rounded-full touch-none"
                style={{
                    background:
                        "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
                }}
            >
                <div
                    className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
                    style={{ left: `${(hsv.h / 360) * 100}%` }}
                />
            </div>
            {/* 十六进制输入 + 预览 */}
            <div className="flex items-center gap-2">
                <span
                    className="size-7 shrink-0 rounded-md border border-edge-hairline"
                    style={{ backgroundColor: currentHex }}
                />
                <input
                    type="text"
                    value={currentHex}
                    onChange={(e) => {
                        const hex = e.target.value;
                        if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
                            setHsv(hexToHsv(hex));
                            onChange(hex);
                        }
                    }}
                    className="h-7 w-full rounded-md border border-edge-hairline bg-transparent px-2 font-mono text-xs uppercase outline-none focus:border-primary"
                    maxLength={7}
                />
            </div>
        </div>
    );
}

/* —————— 颜色转换工具 —————— */

function hexToHsv(hex: string): { h: number; s: number; v: number } {
    const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
    if (!m) return { h: 220, s: 0.8, v: 0.9 };
    const n = Number.parseInt(m[1], 16);
    const r = ((n >> 16) & 255) / 255;
    const g = ((n >> 8) & 255) / 255;
    const b = (n & 255) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
    }
    const s = max === 0 ? 0 : d / max;
    return { h, s, v: max };
}

function hsvToHex(h: number, s: number, v: number): string {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r = 0;
    let g = 0;
    let b = 0;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    const to = (n: number) =>
        Math.round((n + m) * 255)
            .toString(16)
            .padStart(2, "0");
    return `#${to(r)}${to(g)}${to(b)}`;
}
