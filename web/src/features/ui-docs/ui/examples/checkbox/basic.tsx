import { Checkbox, Label } from "@violet/ui";
import { useState } from "react";

/** 复选框基础用法：受控勾选并与 Label 联动切换。 */
export function CheckboxBasicDemo() {
	const [checked, setChecked] = useState(false);
	return (
		<div className="flex items-center justify-center">
			<div className="flex items-center gap-2.5">
				<Checkbox
					id="basic-terms"
					checked={checked}
					onCheckedChange={(val) => setChecked(val === true)}
				/>
				<Label
					htmlFor="basic-terms"
					className="cursor-pointer text-sm font-medium select-none"
				>
					已阅读并同意服务协议（状态：{checked ? "已勾选" : "未勾选"}）
				</Label>
			</div>
		</div>
	);
}
