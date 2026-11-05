import { Label, Textarea } from "@violet/ui";
import { useId, useState } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

const LIMIT = 140;

function TextareaField({ state }: ExhibitRenderProps) {
	const id = useId();
	const [value, setValue] = useState("今天把展柜搬进了陈列室。");
	return (
		<div className="flex flex-col gap-2">
			<Label htmlFor={id}>留言</Label>
			<Textarea
				id={id}
				rows={4}
				maxLength={LIMIT}
				value={value}
				onChange={(event) => setValue(event.currentTarget.value)}
				disabled={state === "disabled"}
				readOnly={state === "readonly"}
			/>
			<p className="self-end font-mono text-xs text-muted-foreground">
				{value.length}/{LIMIT}
			</p>
		</div>
	);
}

export const textareaExhibit: Exhibit = {
	id: "textarea",
	name: "多行输入",
	units: ["textarea", "label"],
	zone: "field",
	category: "form",
	footprint: { width: 320, height: 168 },
	states: [
		{ id: "default", label: "默认" },
		{ id: "disabled", label: "禁用" },
		{ id: "readonly", label: "只读" },
	],
	Render: TextareaField,
};
