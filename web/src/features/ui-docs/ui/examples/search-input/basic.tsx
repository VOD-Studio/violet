import { SearchInput } from "@violet/ui";
import { useState } from "react";

/** 实时编辑与提交的查询分离，回车或清除会立即提交。 */
export function SearchInputBasicDemo() {
	const [value, setValue] = useState("");
	const [query, setQuery] = useState("");

	return (
		<div className="w-full max-w-sm space-y-4">
			<SearchInput
				label="搜索文章"
				variant="soft"
				value={value}
				onValueChange={setValue}
				onSearch={setQuery}
				description="停止输入 300ms 后搜索，回车立即搜索。"
			/>
			<output className="block text-sm text-muted-foreground" aria-live="polite">
				当前查询：{query || "全部文章"}
			</output>
			<SearchInput
				label="只读搜索"
				variant="ghost"
				controlSize="sm"
				defaultValue="保留文本"
				readOnly
			/>
		</div>
	);
}
