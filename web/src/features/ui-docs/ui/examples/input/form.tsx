import { Button, Input } from "@violet/ui";
import { useState } from "react";

/** 使用 FormData 提交非受控字段。 */
export function InputFormDemo() {
	const [submitted, setSubmitted] = useState("");

	return (
		<form
			className="w-full max-w-sm space-y-4"
			onSubmit={(event) => {
				event.preventDefault();
				const data = new FormData(event.currentTarget);
				setSubmitted(String(data.get("email") ?? ""));
			}}
		>
			<Input
				label="邮箱"
				name="email"
				type="email"
				defaultValue="reader@example.com"
				autoComplete="email"
				required
				clearable
			/>
			<div className="flex flex-wrap gap-2">
				<Button type="submit">提交</Button>
				<Button type="reset" variant="ghost">
					重置
				</Button>
			</div>
			{submitted && (
				<p role="status" className="text-sm text-muted-foreground">
					已提交：{submitted}
				</p>
			)}
		</form>
	);
}
