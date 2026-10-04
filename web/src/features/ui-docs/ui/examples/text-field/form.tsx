import { Button, TextField } from "@violet/ui";
import { useRef, useState } from "react";

/** 提交使用原生 FormData，ref 直接指向 input。 */
export function TextFieldFormDemo() {
	const inputRef = useRef<HTMLInputElement>(null);
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
			<TextField
				ref={inputRef}
				label="邮箱"
				name="email"
				type="email"
				defaultValue="reader@example.com"
				autoComplete="email"
				description="示例只读取表单，不发送请求"
				required
			/>
			<div className="flex flex-wrap gap-2">
				<Button type="submit">读取表单</Button>
				<Button variant="outline" onClick={() => inputRef.current?.focus()}>
					聚焦邮箱
				</Button>
				<Button type="reset" variant="ghost">
					重置
				</Button>
			</div>
			<p role="status" className="text-sm text-muted-foreground">
				{submitted ? `读取结果：${submitted}` : "等待提交"}
			</p>
		</form>
	);
}
