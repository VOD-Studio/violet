import { Field, NumberInput, Slider } from "@violet/ui";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

const DENSITY = [
	{ value: 0, label: "无" },
	{ value: 25, label: "稀" },
	{ value: 50, label: "适中" },
	{ value: 75, label: "密" },
	{ value: 100, label: "满" },
];

function SliderRow({
	label,
	value,
	children,
}: {
	label: string;
	value: string;
	children: ReactNode;
}) {
	return (
		<div className="flex min-w-0 flex-col gap-1.5">
			<div className="flex items-baseline justify-between gap-4 text-14">
				<span className="font-medium">{label}</span>
				<span className="font-mono text-13 tabular-nums text-muted-foreground">
					{value}
				</span>
			</div>
			{children}
		</div>
	);
}

function SliderFamily({ state }: ExhibitRenderProps) {
	const [fontSize, setFontSize] = useState([16]);
	const [duration, setDuration] = useState([5, 20]);
	const [density, setDensity] = useState([50]);
	const [opacity, setOpacity] = useState([70]);
	const root = useRef<HTMLSpanElement>(null);
	const disabled = state === "disabled";
	const readOnly = state === "readonly";
	const invalid = state === "invalid";
	useEffect(() => {
		if (state === "focus")
			root.current
				?.querySelector<HTMLElement>('[role="slider"]')
				?.focus({ preventScroll: true });
	}, [state]);
	return (
		<div className="flex w-full flex-col gap-6 px-12 pt-10">
			<Field
				label={
					<span className="flex items-baseline justify-between gap-4">
						正文字号
						<span
							aria-hidden="true"
							className="font-mono text-13 font-normal tabular-nums text-muted-foreground"
						>
							{fontSize[0]} 像素
						</span>
					</span>
				}
				error={invalid ? "请选择 14 到 20 像素之间的字号" : undefined}
			>
				<Slider
					ref={root}
					aria-label="正文字号"
					min={12}
					max={24}
					value={fontSize}
					onValueChange={setFontSize}
					formatValue={(value) => `${value} 像素`}
					disabled={disabled}
					readOnly={readOnly}
					invalid={invalid}
				/>
			</Field>
			<SliderRow label="阅读时长" value={`${duration[0]} – ${duration[1]} 分钟`}>
				<Slider
					aria-label="阅读时长"
					min={1}
					max={60}
					value={duration}
					onValueChange={setDuration}
					formatValue={(value) => `${value} 分钟`}
					disabled={disabled}
					readOnly={readOnly}
				/>
			</SliderRow>
			<SliderRow
				label="背景装饰"
				value={DENSITY.find((mark) => mark.value === density[0])?.label ?? ""}
			>
				<Slider
					aria-label="背景装饰"
					value={density}
					onValueChange={setDensity}
					marks={DENSITY}
					disabled={disabled}
					readOnly={readOnly}
				/>
			</SliderRow>
			<div className="flex items-center gap-4">
				<div className="min-w-0 flex-1">
					<Slider
						aria-label="不透明度"
						value={opacity}
						onValueChange={setOpacity}
						formatValue={(value) => `${value}%`}
						disabled={disabled}
						readOnly={readOnly}
					/>
				</div>
				<div className="w-19 shrink-0">
					<NumberInput
						aria-label="精确不透明度"
						controls="none"
						allowEmpty={false}
						min={0}
						max={100}
						controlSize="sm"
						value={opacity[0]}
						onChange={(event) => {
							const next = Number(event.currentTarget.value);
							if (event.currentTarget.value !== "" && Number.isFinite(next))
								setOpacity([next]);
						}}
						trailing="%"
						disabled={disabled}
						readOnly={readOnly}
					/>
				</div>
			</div>
			<SliderRow label="音量 · 禁用" value="40%">
				<Slider
					aria-label="音量"
					defaultValue={[40]}
					formatValue={(value) => `${value}%`}
					disabled
				/>
			</SliderRow>
		</div>
	);
}

export const sliderExhibit: Exhibit = {
	id: "slider",
	name: "滑块",
	units: ["slider"],
	zone: "field",
	category: "form",
	footprint: { width: 480, height: 568 },
	states: [
		{ id: "default", label: "全部形态" },
		{ id: "focus", label: "键盘聚焦" },
		{ id: "readonly", label: "只读" },
		{ id: "invalid", label: "错误" },
		{ id: "disabled", label: "禁用" },
	],
	Render: SliderFamily,
};
