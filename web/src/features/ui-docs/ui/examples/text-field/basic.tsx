import { TextField } from "@violet/ui";

/** 原生字段属性和说明文字由 TextField 组合到同一输入控件。 */
export function TextFieldBasicDemo() {
	return (
		<div className="w-full max-w-sm space-y-5">
			<TextField
				label="显示名称"
				name="displayName"
				defaultValue="紫罗兰"
				description="这个名称会显示在评论旁"
				autoComplete="nickname"
				maxLength={40}
			/>
			<TextField label="账户编号" defaultValue="violet-001" readOnly />
		</div>
	);
}
