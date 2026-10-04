import { Button, Checkbox, Label } from "@violet/ui";
import { useId, useState } from "react";

/** 非受控选项通过原生 FormData 提交，reset 恢复初始勾选。 */
export function CheckboxFormDemo() {
	const emailId = useId();
	const smsId = useId();
	const [result, setResult] = useState<string>();

	return (
		<form
			className="mx-auto w-full max-w-sm space-y-4"
			onSubmit={(event) => {
				event.preventDefault();
				const values = new FormData(event.currentTarget).getAll("notifications");
				setResult(values.length > 0 ? values.join(", ") : "没有已选通道");
			}}
			onReset={() => setResult(undefined)}
		>
			<fieldset className="space-y-3">
				<legend className="mb-3 text-sm font-medium">通知通道</legend>
				<div className="flex items-center gap-2.5">
					<Checkbox id={emailId} name="notifications" value="email" defaultChecked />
					<Label htmlFor={emailId}>邮件</Label>
				</div>
				<div className="flex items-center gap-2.5">
					<Checkbox id={smsId} name="notifications" value="sms" />
					<Label htmlFor={smsId}>短信</Label>
				</div>
			</fieldset>
			<div className="flex flex-wrap gap-2">
				<Button type="submit" size="sm">
					读取表单
				</Button>
				<Button type="reset" size="sm" variant="outline">
					恢复初值
				</Button>
			</div>
			<p role="status" className="text-sm text-muted-foreground">
				{result ?? "提交后显示表单值，初始仅选邮件。"}
			</p>
		</form>
	);
}
