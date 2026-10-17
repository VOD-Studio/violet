import { Input } from "@violet/ui";
import { LockKeyhole, Search } from "lucide-react";
import { useState } from "react";

/** 清除沿用原生 onChange，密码显隐保留控件内焦点。 */
export function InputActionsDemo() {
	const [query, setQuery] = useState("Violet");

	return (
		<div className="w-full max-w-sm space-y-5">
			<Input
				label="搜索"
				value={query}
				onChange={(event) => setQuery(event.target.value)}
				leading={<Search aria-hidden="true" />}
				clearable
				clearLabel="清除搜索"
			/>
			<Input
				type="password"
				label="密码"
				defaultValue="violet-demo"
				autoComplete="new-password"
				leading={<LockKeyhole aria-hidden="true" />}
				passwordToggle
				clearable
			/>
		</div>
	);
}
