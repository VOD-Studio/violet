import { Checkbox, Label } from "@violet/ui";

/** 复选框视觉变体：default 主要语义与 primary 固定主色。 */
export function CheckboxVariantsDemo() {
	return (
		<div className="flex flex-wrap items-center justify-center gap-8">
			<div className="flex items-center gap-2.5">
				<Checkbox id="demo-var-default" variant="default" defaultChecked />
				<Label htmlFor="demo-var-default" className="cursor-pointer select-none">
					Default 主要动作
				</Label>
			</div>
			<div className="flex items-center gap-2.5">
				<Checkbox id="demo-var-primary" variant="primary" defaultChecked />
				<Label htmlFor="demo-var-primary" className="cursor-pointer select-none">
					Primary 主色专属
				</Label>
			</div>
		</div>
	);
}
