import { Input, Label } from "@violet/ui";
import { useState } from "react";

/** 展示输入值及由消费方控制的错误状态。 */
export function InputBasicDemo() {
	const [name, setName] = useState("");
	const invalid = name.length > 0 && name.trim().length < 2;

	return (
		<div className="w-full max-w-sm space-y-2">
			<Label htmlFor="input-demo-name">显示名称</Label>
			<Input
				id="input-demo-name"
				value={name}
				onChange={(event) => setName(event.target.value)}
				placeholder="至少输入两个字符"
				aria-invalid={invalid}
				aria-describedby="input-demo-hint"
			/>
			<p id="input-demo-hint" className="text-sm text-muted-foreground">
				{invalid ? "显示名称至少需要两个非空白字符。" : `当前输入：${name || "（空）"}`}
			</p>
		</div>
	);
}
