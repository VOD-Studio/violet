import { SearchInput } from "@violet/ui";
import { useState } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

function SearchField({ state }: ExhibitRenderProps) {
	const [query, setQuery] = useState("");
	return (
		<div className="flex flex-col gap-3">
			<SearchInput
				label="搜索文章"
				variant="soft"
				defaultValue={state === "loading" ? "组件" : undefined}
				onSearch={setQuery}
				loading={state === "loading"}
				disabled={state === "disabled"}
				description="停止输入 300ms 后搜索，回车立即搜索"
			/>
			<output className="text-sm text-muted-foreground" aria-live="polite">
				当前查询：{query || "全部文章"}
			</output>
		</div>
	);
}

export const searchInputExhibit: Exhibit = {
	id: "search-input",
	name: "搜索框",
	units: ["search-input"],
	zone: "field",
	category: "form",
	footprint: { width: 320, height: 132 },
	states: [
		{ id: "default", label: "默认" },
		{ id: "loading", label: "搜索中" },
		{ id: "disabled", label: "禁用" },
	],
	Render: SearchField,
};
