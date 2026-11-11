import { Sortable } from "@violet/ui";
import { useState } from "react";
import { useStageContainer } from "../../hooks/use-stage-container";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

const CHAPTERS = [
	{ id: "rain", title: "在雨停之前" },
	{ id: "valley", title: "穿过河谷" },
	{ id: "wind", title: "山口的风" },
	{ id: "lake", title: "湖边的夜" },
];
function SortableStage({ state }: ExhibitRenderProps) {
	const [chapters, setChapters] = useState(CHAPTERS);
	const { ref, container } = useStageContainer();
	return (
		<div ref={ref} className="w-full">
			<Sortable
				aria-label="章节顺序"
				items={chapters}
				getId={(item) => item.id}
				getLabel={(item) => item.title}
				onReorder={setChapters}
				disabled={state === "disabled"}
				menuContainer={container}
				renderItem={(item, index) => (
					<div className="flex items-center gap-3">
						<span className="w-5 font-mono text-xs text-muted-foreground">
							{index + 1}
						</span>
						<span>{item.title}</span>
					</div>
				)}
			/>
			<p className="mt-3 text-xs leading-6 text-muted-foreground">
				把手上按空格拿起，↑↓ 移动，空格放下，Esc 取消；也可用每行右侧菜单调整。
			</p>
		</div>
	);
}
export const sortableExhibit: Exhibit = {
	id: "sortable",
	name: "拖拽排序",
	units: ["sortable"],
	zone: "content",
	category: "layout",
	footprint: { width: 520, height: 296 },
	states: [
		{ id: "default", label: "章节排序" },
		{ id: "disabled", label: "不可调整" },
	],
	Render: SortableStage,
};
