import { Button } from "@violet/ui";
import { Plus } from "lucide-react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

const VARIANTS = [
	["default", "主要动作"],
	["primary", "主色强调"],
	["secondary", "次要动作"],
	["soft", "柔和淡染"],
	["outline", "描边动作"],
	["ghost", "轻量动作"],
	["link", "文字动作"],
	["destructive", "删除"],
] as const;

const SIZES = [
	["sm", "小"],
	["default", "中"],
	["lg", "大"],
] as const;

function ButtonFamily({ state }: ExhibitRenderProps) {
	const loading = state === "loading";
	const disabled = state === "disabled";
	return (
		<div className="flex flex-col items-start gap-4">
			<div className="grid grid-cols-4 gap-2">
				{VARIANTS.map(([variant, label]) => (
					<Button key={variant} variant={variant} loading={loading} disabled={disabled}>
						{label}
					</Button>
				))}
			</div>
			<div className="flex items-center gap-2">
				{SIZES.map(([size, label]) => (
					<Button key={size} size={size} loading={loading} disabled={disabled}>
						{label}号按钮
					</Button>
				))}
				<Button size="icon" variant="secondary" aria-label="新建" disabled={disabled}>
					<Plus aria-hidden="true" />
				</Button>
			</div>
		</div>
	);
}

export const buttonExhibit: Exhibit = {
	id: "button",
	name: "按钮",
	units: ["button"],
	zone: "shelf",
	category: "action",
	footprint: { width: 440, height: 136 },
	states: [
		{ id: "default", label: "默认" },
		{ id: "loading", label: "加载" },
		{ id: "disabled", label: "禁用" },
	],
	Render: ButtonFamily,
};
