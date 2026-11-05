import { Input, type InputProps } from "@violet/ui";
import { Mail } from "lucide-react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

const VARIANTS: { variant: NonNullable<InputProps["variant"]>; label: string }[] = [
	{ variant: "outline", label: "描边" },
	{ variant: "soft", label: "填充" },
	{ variant: "ghost", label: "无框" },
	{ variant: "underline", label: "下划线" },
];

function InputFields({ state }: ExhibitRenderProps) {
	return (
		<div className="grid grid-cols-2 gap-x-6 gap-y-5">
			{VARIANTS.map(({ variant, label }) => (
				<Input
					key={variant}
					variant={variant}
					label={`${label}邮箱`}
					type="email"
					defaultValue="reader@example.com"
					leading={<Mail aria-hidden="true" />}
					clearable
					description={state === "invalid" ? undefined : "只用于回复通知"}
					invalid={state === "invalid"}
					errorMessage="邮箱缺少域名"
					loading={state === "loading"}
					disabled={state === "disabled"}
					readOnly={state === "readonly"}
				/>
			))}
		</div>
	);
}

export const inputExhibit: Exhibit = {
	id: "input",
	name: "输入框",
	units: ["input", "label"],
	zone: "field",
	category: "form",
	footprint: { width: 520, height: 216 },
	states: [
		{ id: "default", label: "默认" },
		{ id: "loading", label: "加载中" },
		{ id: "invalid", label: "错误" },
		{ id: "disabled", label: "禁用" },
		{ id: "readonly", label: "只读" },
	],
	Render: InputFields,
};
