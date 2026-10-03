import { Checkbox, Label } from "@violet/ui";

/** 复选框禁用状态：未选、已选与半选的禁用形态。 */
export function CheckboxDisabledDemo() {
	return (
		<div className="flex flex-wrap items-center justify-center gap-8">
			<div className="flex items-center gap-2.5">
				<Checkbox id="demo-dis-unchecked" disabled />
				<Label htmlFor="demo-dis-unchecked" className="text-muted-foreground">
					未选禁用
				</Label>
			</div>
			<div className="flex items-center gap-2.5">
				<Checkbox id="demo-dis-checked" defaultChecked disabled />
				<Label htmlFor="demo-dis-checked" className="text-muted-foreground">
					已选禁用
				</Label>
			</div>
			<div className="flex items-center gap-2.5">
				<Checkbox id="demo-dis-indeterminate" checked="indeterminate" disabled />
				<Label htmlFor="demo-dis-indeterminate" className="text-muted-foreground">
					半选禁用
				</Label>
			</div>
		</div>
	);
}
