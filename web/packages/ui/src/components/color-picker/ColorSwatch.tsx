import { cn } from "cn";
import { Baseline, ChevronDown, CircleAlert } from "lucide-react";
import { type ComponentProps, useId, useState } from "react";
import { Popover, PopoverContent, type PopoverContentProps, PopoverTrigger } from "../popover";
import { HsvColorPicker } from "./HsvColorPicker";
import { normalizeHexColor } from "./hsv";

/** 文字预设来自 ColorPicker 设计稿；主题四季种子不属于文字颜色。 */
export const TEXT_COLOR_PRESETS = [
	{ name: "朱砂", value: "#c63c26" },
	{ name: "赭石", value: "#9c5333" },
	{ name: "琥珀", value: "#946708" },
	{ name: "苔绿", value: "#5f7a2a" },
	{ name: "竹青", value: "#2f7d4f" },
	{ name: "石青", value: "#1d7286" },
	{ name: "靛蓝", value: "#2e4e9a" },
	{ name: "藏青", value: "#2b3a55" },
	{ name: "紫棠", value: "#6b3f7a" },
	{ name: "胭脂", value: "#b0365a" },
	{ name: "檀褐", value: "#6e4b3a" },
	{ name: "墨灰", value: "#55524f" },
] as const;

/** 文字色触发器与共用取色面板；最近记录、编辑器选区和纸面颜色归调用方所有。 */
export interface ColorSwatchProps
	extends Pick<PopoverContentProps, "container" | "collisionBoundary"> {
	value?: string;
	onChange: (color: string) => void;
	onClear: () => void;
	onColorCommit?: (color: string) => void;
	recentColors?: readonly string[];
	/** 调用方按实际纸面计算，不使用主题种子或按钮对比度代替。 */
	contrast?: { ratio: number; minimum?: number };
	disabled?: boolean;
	readOnly?: boolean;
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	defaultCustomOpen?: boolean;
	/** 原生触发按钮属性；onClick/onPointerDown 可取消内部打开动作。 */
	triggerProps?: Omit<ComponentProps<"button">, "value" | "onChange" | "disabled" | "children">;
}

/** 文字颜色选择器：传统色、最近色、可展开 HSV 面板与恢复正文色。 */
export function ColorSwatch({
	value,
	onChange,
	onClear,
	onColorCommit,
	recentColors = [],
	contrast,
	disabled = false,
	readOnly = false,
	open,
	defaultOpen,
	onOpenChange,
	defaultCustomOpen = false,
	container,
	collisionBoundary,
	triggerProps = {},
}: ColorSwatchProps) {
	const [customOpen, setCustomOpen] = useState(defaultCustomOpen);
	const customId = useId();
	const current = value ? normalizeHexColor(value) : null;
	const locked = disabled || readOnly;
	const recent = Array.from(
		new Set(
			recentColors.map(normalizeHexColor).filter((color): color is string => color !== null),
		),
	).slice(0, 6);
	const pick = (color: string) => {
		if (locked) return;
		onChange(color);
		onColorCommit?.(color);
	};
	const swatches = (colors: readonly { name: string; value: string }[], label: string) => (
		<div className="v-color-swatch__grid" role="group" aria-label={label}>
			{colors.map((color) => (
				<button
					key={color.value}
					type="button"
					className="v-color-swatch__swatch"
					aria-label={color.name}
					title={`${color.name} ${color.value.toUpperCase()}`}
					aria-pressed={current === color.value}
					disabled={locked}
					style={{ backgroundColor: color.value }}
					onClick={() => pick(color.value)}
				/>
			))}
		</div>
	);
	return (
		<Popover open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
			<PopoverTrigger asChild>
				<button
					{...triggerProps}
					type="button"
					className={cn("v-color-swatch__trigger", triggerProps.className)}
					aria-label={triggerProps["aria-label"] ?? "文字颜色"}
					disabled={disabled}
				>
					<span className="v-color-swatch__letter" aria-hidden="true">
						A<span style={{ backgroundColor: current ?? "currentColor" }} />
					</span>
					<ChevronDown aria-hidden="true" />
				</button>
			</PopoverTrigger>
			<PopoverContent
				container={container}
				collisionBoundary={collisionBoundary}
				sideOffset={6}
				className="v-color-swatch__popover"
				aria-label="文字颜色"
			>
				{recent.length > 0 && (
					<>
						<div className="v-color-swatch__label">最近使用</div>
						{swatches(
							recent.map((color) => ({
								value: color,
								name:
									TEXT_COLOR_PRESETS.find((preset) => preset.value === color)
										?.name ?? color.toUpperCase(),
							})),
							"最近使用",
						)}
					</>
				)}
				<div className="v-color-swatch__label">预设</div>
				{swatches(TEXT_COLOR_PRESETS, "预设")}
				<button
					type="button"
					className="v-color-swatch__more"
					aria-expanded={customOpen}
					aria-controls={customId}
					onClick={() => setCustomOpen(!customOpen)}
				>
					自定义
					<ChevronDown aria-hidden="true" />
				</button>
				<div
					id={customId}
					className="v-color-swatch__custom"
					data-open={customOpen || undefined}
					inert={!customOpen}
					aria-hidden={!customOpen}
				>
					<div className="v-color-swatch__clip">
						<div className="v-color-swatch__custom-inner">
							<HsvColorPicker
								value={current ?? "#2e4e9a"}
								onChange={onChange}
								onColorCommit={onColorCommit}
								disabled={disabled}
								readOnly={readOnly}
							/>
						</div>
					</div>
				</div>
				{contrast &&
					Number.isFinite(contrast.ratio) &&
					contrast.ratio < (contrast.minimum ?? 4.5) && (
						<div className="v-color-swatch__warning" role="status">
							<CircleAlert aria-hidden="true" />
							<span>
								在纸面上对比度 {contrast.ratio.toFixed(1)}:1，正文读起来吃力，建议{" "}
								{contrast.minimum ?? 4.5} 以上
							</span>
						</div>
					)}
				<button
					type="button"
					className="v-color-swatch__clear"
					disabled={locked}
					onClick={() => {
						if (!locked) onClear();
					}}
				>
					<Baseline aria-hidden="true" />
					<span>
						清除颜色<small>恢复正文色</small>
					</span>
				</button>
			</PopoverContent>
		</Popover>
	);
}
