import { TextField } from "@violet/ui";
import { useState } from "react";

/** 校验规则留在消费方，错误仅在离开字段后显示。 */
export function TextFieldValidationDemo() {
	const [name, setName] = useState("");
	const [touched, setTouched] = useState(false);
	const invalid = touched && name.trim().length < 2;

	return (
		<div className="w-full max-w-sm space-y-3">
			<TextField
				label="显示名称"
				name="displayName"
				value={name}
				onChange={(event) => setName(event.target.value)}
				onBlur={() => setTouched(true)}
				invalid={invalid}
				errorMessage="至少输入两个非空白字符"
				description="输入后移开焦点，查看校验结果"
				placeholder="例如：紫罗兰"
				required
			/>
			<p className="text-sm text-muted-foreground">当前值：{name || "（空）"}</p>
		</div>
	);
}
