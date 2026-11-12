import { ScrollArea, Sortable } from "@violet/ui";
import { useState } from "react";
import { useStageContainer } from "../../hooks/use-stage-container";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

const CHAPTERS = [
	{ id: "rain", title: "在雨停之前" },
	{ id: "valley", title: "穿过河谷" },
	{ id: "wind", title: "山口的风" },
	{ id: "lake", title: "湖边的夜" },
];
const LONG_CHAPTERS = [
	...CHAPTERS,
	{ id: "morning", title: "雾中的清晨" },
	{ id: "forest", title: "林间的小径" },
	{ id: "bridge", title: "旧桥的另一端" },
	{ id: "village", title: "山村来信" },
	{ id: "snow", title: "第一场雪" },
	{ id: "fire", title: "炉火旁的故事" },
	{ id: "stars", title: "群星之间" },
	{ id: "home", title: "回家的路" },
];

function SortableStage({ state }: ExhibitRenderProps) {
	const scrollable = state === "scroll";
	const [chapters, setChapters] = useState(scrollable ? LONG_CHAPTERS : CHAPTERS);
	const { ref, container } = useStageContainer();
	const list = (
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
					<span className="w-5 font-mono text-xs text-muted-foreground">{index + 1}</span>
					<span>{item.title}</span>
				</div>
			)}
		/>
	);

	return (
		<div ref={ref} className="w-full">
			{scrollable ? (
				<ScrollArea aria-label="长章节目录" className="h-58 w-full" viewportClassName="p-1">
					{list}
				</ScrollArea>
			) : (
				list
			)}
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
		{ id: "scroll", label: "长列表滚动" },
	],
	Render: (props) => <SortableStage key={props.state} {...props} />,
};
