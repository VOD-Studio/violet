import { Checkbox, Label } from "@violet/ui";
import { useId, useState } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

const CHANNELS = [
	{ id: "email", label: "邮件通知" },
	{ id: "push", label: "浏览器推送" },
	{ id: "digest", label: "每周摘要" },
];

function CheckboxFamily({ state }: ExhibitRenderProps) {
	const id = useId();
	const [selected, setSelected] = useState(["email"]);
	const disabled = state === "disabled";
	const all = selected.length === CHANNELS.length;
	const toggle = (channel: string) =>
		setSelected((current) =>
			current.includes(channel)
				? current.filter((item) => item !== channel)
				: [...current, channel],
		);
	return (
		<div className="flex flex-col gap-2.5">
			<div className="flex items-center gap-2.5">
				<Checkbox
					id={`${id}-all`}
					checked={all ? true : selected.length > 0 ? "indeterminate" : false}
					onCheckedChange={() => setSelected(all ? [] : CHANNELS.map((item) => item.id))}
					disabled={disabled}
				/>
				<Label htmlFor={`${id}-all`} className="font-medium">
					全部通知（{selected.length}/{CHANNELS.length}）
				</Label>
			</div>
			{CHANNELS.map((channel) => (
				<div key={channel.id} className="flex items-center gap-2.5 pl-6">
					<Checkbox
						id={`${id}-${channel.id}`}
						checked={selected.includes(channel.id)}
						onCheckedChange={() => toggle(channel.id)}
						disabled={disabled}
					/>
					<Label htmlFor={`${id}-${channel.id}`}>{channel.label}</Label>
				</div>
			))}
		</div>
	);
}

export const checkboxExhibit: Exhibit = {
	id: "checkbox",
	name: "复选框",
	units: ["checkbox", "label"],
	zone: "shelf",
	category: "form",
	footprint: { width: 220, height: 116 },
	states: [
		{ id: "default", label: "默认" },
		{ id: "disabled", label: "禁用" },
	],
	Render: CheckboxFamily,
};
