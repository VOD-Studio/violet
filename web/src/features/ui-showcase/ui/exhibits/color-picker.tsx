import {
	Button,
	ColorSwatch,
	Field,
	HsvColorPicker,
	type HsvColorPickerProps,
	useFieldControl,
} from "@violet/ui";
import { useState } from "react";
import { useStageContainer } from "../../hooks/use-stage-container";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

function paperContrast(hex: string) {
	const luminance = (color: string) => {
		const channels = [1, 3, 5]
			.map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16) / 255)
			.map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
		return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
	};
	const paper = luminance("#fbf8f6");
	const color = luminance(hex);
	return (Math.max(paper, color) + 0.05) / (Math.min(paper, color) + 0.05);
}

function ColorPanel(props: HsvColorPickerProps) {
	const field = useFieldControl();
	return (
		<div className="w-fit rounded-xl border border-border bg-card p-3.5">
			<HsvColorPicker {...props} hexInputProps={{ ...field, "aria-label": "种子色 HEX" }} />
		</div>
	);
}

function ColorSpecimen({ state }: ExhibitRenderProps) {
	const stage = useStageContainer();
	const [value, setValue] = useState(state === "low-contrast" ? "#e7c5b5" : "#2e4e9a");
	const [recent, setRecent] = useState(["#2e4e9a", "#c63c26", "#2f7d4f"]);
	const [cleared, setCleared] = useState(false);
	const text = state === "text" || state === "custom" || state === "low-contrast";
	return (
		<div ref={stage.ref} className="relative h-full w-full p-5">
			{text ? (
				<>
					<ColorSwatch
						key={state}
						value={cleared ? undefined : value}
						defaultOpen
						defaultCustomOpen={state !== "text"}
						container={stage.container}
						collisionBoundary={stage.container}
						recentColors={recent}
						contrast={cleared ? undefined : { ratio: paperContrast(value) }}
						onChange={(hex) => {
							setValue(hex);
							setCleared(false);
						}}
						onColorCommit={(hex) =>
							setRecent((colors) =>
								[hex, ...colors.filter((color) => color !== hex)].slice(0, 6),
							)
						}
						onClear={() => setCleared(true)}
					/>
					<p
						className="absolute top-5 right-5 m-0 w-60 rounded-xl p-3 text-base leading-7"
						style={{ backgroundColor: "#fbf8f6", color: "#2f2a28" }}
					>
						落花的轨迹用三次贝塞尔曲线模拟，
						<span style={{ color: cleared ? "inherit" : value }}>
							控制点跟着风速抖一下
						</span>
						，看起来就不那么机械。
					</p>
				</>
			) : (
				<div className="flex flex-col gap-5">
					<Field
						label="种子色"
						error={
							state === "invalid"
								? "请输入 3 位或 6 位十六进制，比如 C63 或 CC6633"
								: undefined
						}
					>
						<ColorPanel
							key={state}
							value={value}
							onChange={setValue}
							originalValue="#f47983"
							disabled={state === "disabled"}
							readOnly={state === "readonly"}
							invalid={state === "invalid" ? true : undefined}
						/>
					</Field>
					<Button
						variant="secondary"
						size="sm"
						disabled={state === "disabled" || state === "readonly"}
						onClick={() => setValue(value === "#2f7d4f" ? "#2e4e9a" : "#2f7d4f")}
					>
						外部更新颜色
					</Button>
					<output className="font-mono text-13 text-muted-foreground">
						{value.toUpperCase()}
					</output>
				</div>
			)}
		</div>
	);
}

export const colorPickerExhibit: Exhibit = {
	id: "color-picker",
	name: "取色",
	units: ["color-picker"],
	zone: "stage",
	category: "form",
	footprint: { width: 600, height: 800 },
	states: [
		{ id: "panel", label: "取色面板" },
		{ id: "text", label: "文字预设与最近使用" },
		{ id: "custom", label: "自定义展开" },
		{ id: "low-contrast", label: "纸面对比度提醒" },
		{ id: "invalid", label: "HEX 错误" },
		{ id: "readonly", label: "只读" },
		{ id: "disabled", label: "禁用" },
	],
	Render: ColorSpecimen,
};
