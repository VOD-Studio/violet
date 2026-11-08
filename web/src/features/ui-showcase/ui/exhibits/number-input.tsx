import { Field, NumberInput, type NumberInputProps } from "@violet/ui";
import { useEffect, useRef, useState } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

const variants: { value: NonNullable<NumberInputProps["variant"]>; label: string }[] = [
	{ value: "filled", label: "填充" },
	{ value: "outline", label: "描边" },
	{ value: "underline", label: "下划线" },
	{ value: "plain", label: "无框" },
];

function NumberFields({ state }: ExhibitRenderProps) {
	const first = useRef<HTMLInputElement>(null);
	const [committed, setCommitted] = useState<number | null>(10);
	useEffect(() => {
		if (state === "focus") first.current?.focus({ preventScroll: true });
	}, [state]);
	if (state === "sizes") {
		return (
			<div className="flex flex-col gap-5">
				{(["sm", "md", "lg"] as const).map((size) => (
					<Field key={size} label={`${size} · 数量`}>
						<NumberInput controlSize={size} defaultValue={10} min={0} max={100} />
					</Field>
				))}
			</div>
		);
	}
	if (state === "layouts") {
		return (
			<div className="grid grid-cols-2 gap-x-5 gap-y-6">
				<Field label="两侧步进" hint="0–100 · 每次 5">
					<NumberInput defaultValue={10} min={0} max={100} step={5} />
				</Field>
				<Field label="价格" hint="右侧上下 · 两位小数">
					<NumberInput
						controls="stacked"
						leading="¥"
						defaultValue={12.5}
						min={0}
						max={9999}
						step={0.5}
						precision={2}
					/>
				</Field>
				<Field label="比例" hint="无按钮 · ↑↓ 仍可调整">
					<NumberInput controls="none" trailing="%" defaultValue={60} min={0} max={100} />
				</Field>
				<Field label="小范围" hint="1–10 · 到边界停下">
					<NumberInput defaultValue={1} min={1} max={10} />
				</Field>
			</div>
		);
	}
	if (state === "commit") {
		return (
			<div className="flex flex-col gap-5">
				<Field label="预算" optional hint="可留空；Enter 或移出输入区提交。">
					<NumberInput
						defaultValue={10}
						leading="¥"
						controls="stacked"
						min={0}
						max={100}
						step={0.1}
						precision={2}
						onValueCommit={setCommitted}
					/>
				</Field>
				<output className="text-sm text-muted-foreground">
					已提交：{committed === null ? "未设置" : committed.toFixed(2)}
				</output>
			</div>
		);
	}
	return (
		<div data-number-demo={state} className="grid grid-cols-2 gap-x-5 gap-y-6">
			<style>{`[data-number-demo="hover"] .v-input-control:where(:not([data-disabled],[data-readonly],:focus-within)){background-color:var(--v-input-bg-hover);box-shadow:var(--v-input-shadow-hover)}`}</style>
			{variants.map(({ value, label }, index) => (
				<Field
					key={`${state}-${value}`}
					label={label}
					error={state === "invalid" ? "请输入 0 到 100 之间的数值" : undefined}
				>
					<NumberInput
						ref={index === 0 ? first : undefined}
						variant={value}
						defaultValue={state === "invalid" ? 120 : 10}
						min={0}
						max={100}
						invalid={state === "invalid"}
						readOnly={state === "readonly"}
						disabled={state === "disabled"}
					/>
				</Field>
			))}
		</div>
	);
}

/** 数值输入的独立四变体、三布局与原生输入交互舞台。 */
export const numberInputExhibit: Exhibit = {
	id: "number-input",
	name: "数字输入",
	units: ["number-input"],
	zone: "field",
	category: "form",
	footprint: { width: 500, height: 320 },
	states: [
		{ id: "layouts", label: "步进布局" },
		{ id: "variants", label: "四种变体" },
		{ id: "hover", label: "悬停" },
		{ id: "focus", label: "聚焦全选" },
		{ id: "sizes", label: "三档尺寸" },
		{ id: "invalid", label: "超出范围" },
		{ id: "readonly", label: "只读" },
		{ id: "disabled", label: "禁用" },
		{ id: "commit", label: "草稿与提交" },
	],
	Render: NumberFields,
};
