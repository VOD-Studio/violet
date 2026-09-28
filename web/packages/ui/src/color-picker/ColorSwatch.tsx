/**
 * ColorSwatch - 文字颜色选择器
 *
 * 色板式颜色选择：预设色块网格 + 自定义 HSV 选色器（饱和度/明度面板 + 色相条）+ 清除。
 * 自定义选色器不依赖原生 input[type=color]，自绘指针交互。
 */

import { cn } from "cn";
import { Baseline, Palette } from "lucide-react";

import { Button } from "../button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "../dropdown-menu";

import { HsvColorPicker } from "./HsvColorPicker";

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
				<HsvColorPicker value={value || "#3b82f6"} onChange={onChange} />
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
