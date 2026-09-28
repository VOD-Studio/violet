import { Checkbox, Label } from "@violet/ui";

/** 复选框尺寸梯度：sm、default 与 lg 三档点击区域。 */
export function CheckboxSizesDemo() {
	return (
		<div className="flex flex-wrap items-center justify-center gap-8">
			<div className="flex items-center gap-2">
				<Checkbox id="demo-size-sm" size="sm" defaultChecked />
				<Label htmlFor="demo-size-sm" className="cursor-pointer text-xs select-none">
					小号 sm (14px)
				</Label>
			</div>
			<div className="flex items-center gap-2.5">
				<Checkbox id="demo-size-default" size="default" defaultChecked />
				<Label htmlFor="demo-size-default" className="cursor-pointer text-sm select-none">
					默认 default (16px)
				</Label>
			</div>
			<div className="flex items-center gap-3">
				<Checkbox id="demo-size-lg" size="lg" defaultChecked />
				<Label
					htmlFor="demo-size-lg"
					className="cursor-pointer text-base font-medium select-none"
				>
					大号 lg (20px)
				</Label>
			</div>
		</div>
	);
}
