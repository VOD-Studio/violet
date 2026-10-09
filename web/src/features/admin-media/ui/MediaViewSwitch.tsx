import { Segmented, type SegmentedItem } from "@violet/ui";
import { LayoutGrid, Table } from "lucide-react";

export type MediaViewMode = "grid" | "table";

const SEGMENTS: SegmentedItem<MediaViewMode>[] = [
	{ value: "grid", icon: <LayoutGrid size={14} />, label: "网格" },
	{ value: "table", icon: <Table size={14} />, label: "表格" },
];

export interface MediaViewSwitchProps {
	value: MediaViewMode;
	onValueChange: (value: MediaViewMode) => void;
}

/** 素材页的网格/表格视图切换。 */
export function MediaViewSwitch({ value, onValueChange }: MediaViewSwitchProps) {
	return (
		<Segmented
			aria-label="素材视图"
			value={value}
			onValueChange={onValueChange}
			segments={SEGMENTS}
			size="default"
		/>
	);
}
