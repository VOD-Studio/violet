import { Segmented } from "@violet/ui";
import { LayoutGrid, List, Table } from "lucide-react";
import { useState } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

const RANGES = [
	{ value: "day", label: "日" },
	{ value: "week", label: "周" },
	{ value: "month", label: "月" },
	{ value: "year", label: "年" },
];
const VIEWS = [
	{ value: "grid", icon: <LayoutGrid size={14} />, label: "网格" },
	{ value: "list", icon: <List size={14} />, label: "列表" },
	{ value: "table", icon: <Table size={14} />, label: "表格" },
];
const VARIANTS = ["soft", "ink", "line"] as const;

function SegmentedFamily({ state }: ExhibitRenderProps) {
	const [range, setRange] = useState("week");
	const [view, setView] = useState("grid");
	const disabled = state === "disabled";
	return (
		<div className="flex flex-col items-start gap-3">
			{VARIANTS.map((variant) => (
				<Segmented
					key={variant}
					aria-label={`${variant} 统计范围`}
					variant={variant}
					value={range}
					onValueChange={setRange}
					segments={RANGES}
					disabled={disabled}
				/>
			))}
			<Segmented
				aria-label="视图类型"
				value={view}
				onValueChange={setView}
				segments={VIEWS}
				disabled={disabled}
			/>
		</div>
	);
}

export const segmentedExhibit: Exhibit = {
	id: "segmented",
	name: "分段控制",
	units: ["segmented"],
	zone: "shelf",
	category: "action",
	footprint: { width: 280, height: 168 },
	states: [
		{ id: "default", label: "默认" },
		{ id: "disabled", label: "禁用" },
	],
	Render: SegmentedFamily,
};
