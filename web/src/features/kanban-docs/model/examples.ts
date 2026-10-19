import type { ComponentType } from "react";
import { CanvasBoard } from "../../../../packages/kanban/examples/canvas";
import canvasSource from "../../../../packages/kanban/examples/canvas.tsx?raw";
import { EditableBoard } from "../../../../packages/kanban/examples/editable";
import editableSource from "../../../../packages/kanban/examples/editable.tsx?raw";
import { Graph } from "../../../../packages/kanban/examples/graph";
import graphSource from "../../../../packages/kanban/examples/graph.tsx?raw";
import { QuickStart } from "../../../../packages/kanban/examples/quick-start";
import quickStartSource from "../../../../packages/kanban/examples/quick-start.tsx?raw";

/** 一个演示：包里 examples/ 的同一个文件，既渲染成预览，也原样作为可复制的源码。 */
export interface KanbanExample {
	/** examples/ 里的文件名，不含扩展名 */
	id: string;
	title: string;
	/** 怎么操作、看点是什么 */
	description: string;
	Component: ComponentType;
	source: string;
}

export const KANBAN_EXAMPLES: readonly KanbanExample[] = [
	{
		id: "editable",
		title: "可编辑看板与历史",
		description:
			"拖动卡片换列或排序；也可以 Tab 聚焦卡片，空格拿起、方向键移动、空格放下，或用卡片上的「Move to…」菜单。每次移动记入本地历史，可撤销、重做。「Done」一列自动排序：移进去的卡片排在最前，列内不能手动调整顺序。",
		Component: EditableBoard,
		source: editableSource,
	},
	{
		id: "quick-start",
		title: "只读看板",
		description: "不传 onMove 时卡片只读，没有拖动与移动菜单。",
		Component: QuickStart,
		source: quickStartSource,
	},
	{
		id: "canvas",
		title: "画布与窄屏布局",
		description:
			"宽屏放进可平移缩放的画布：拖动空白处平移，Ctrl/⌘ 加滚轮缩放，可全屏。窄屏换成阶段切换器，两种布局共用同一份受控状态。",
		Component: CanvasBoard,
		source: canvasSource,
	},
	{
		id: "graph",
		title: "关系图",
		description: "同一份关系既画成图，也列成可阅读的文字；点卡片高亮它的关系。",
		Component: Graph,
		source: graphSource,
	},
];
