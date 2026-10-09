import { Segmented } from "@violet/ui";
import { LayoutGrid, Table } from "lucide-react";
import { useState } from "react";

const RANGE_SEGMENTS = [
	{ value: "day", label: "日" },
	{ value: "week", label: "周" },
	{ value: "month", label: "月" },
	{ value: "archived", label: "已归档", disabled: true },
];
const VIEW_SEGMENTS = [
	{ value: "grid", icon: <LayoutGrid size={14} />, label: "网格" },
	{ value: "table", icon: <Table size={14} />, label: "表格" },
];

/** 受控的基础分段：文字分段、禁用项，以及带图标的视图切换。 */
export function SegmentedBasicDemo() {
	const [range, setRange] = useState("week");
	const [view, setView] = useState("grid");

	return (
		<div className="w-full max-w-sm space-y-4">
			<Segmented
				aria-label="统计范围"
				value={range}
				onValueChange={setRange}
				segments={RANGE_SEGMENTS}
			/>
			<Segmented
				aria-label="视图类型"
				value={view}
				onValueChange={setView}
				segments={VIEW_SEGMENTS}
			/>
			<p className="text-sm text-muted-foreground" aria-live="polite">
				范围：{range}；视图：{view}。
			</p>
		</div>
	);
}
