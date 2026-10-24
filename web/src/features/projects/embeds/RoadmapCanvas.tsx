import { Canvas } from "@violetjs/kanban/canvas";
import { RelationGraph } from "@violetjs/kanban/graph";
import { Board } from "@violetjs/kanban/unstyled";
import { useMemo } from "react";
import { buildRoadmapBoard, toBoardRelations } from "../lib/roadmap-board";
import type { RoadmapItem } from "../model/roadmap";
import { RoadmapCardContent } from "../ui/RoadmapCardContent";
import type { RoadmapCanvasEmbedProps } from "./RoadmapCanvasEmbed";
import "../ui/roadmap-board.css";

/** 已进入准备范围的画布输入，与外层占位使用相同高度。 */
export interface RoadmapCanvasProps extends Omit<RoadmapCanvasEmbedProps, "header"> {
	/** CSS 长度，由外层同时用于加载占位。 */
	height: string;
}

/** 关系图条目的内容与详情打开入口。 */
export interface GraphNodeProps {
	item: RoadmapItem;
	/** 同时传回触发按钮，关闭详情后用于恢复焦点。 */
	onOpen: RoadmapCanvasProps["onOpen"];
}

// 最小缩放 50% 时顶部内边距只剩 22px，适应窗口还须为浮动工具栏留出 32px。
const FIT_PADDING = 32;
// 关系图节点容纳编号与两行标题。
const NODE = { width: 240, height: 76 };
const label = (item: RoadmapItem) => `#${item.number} ${item.title}`;

function GraphNode({ item, onOpen }: GraphNodeProps) {
	return (
		<button
			type="button"
			aria-haspopup="dialog"
			onClick={(event) => onOpen(item, event.currentTarget)}
			className="block size-full cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
		>
			<span className="font-mono text-xs text-muted-foreground">#{item.number}</span>
			<span className="mt-1 line-clamp-2 font-reading text-sm leading-snug font-medium">
				{item.title}
			</span>
		</button>
	);
}

/** 提供可平移、缩放和全屏的看板或关系图；普通滚轮仍交给文章滚动。 */
export function RoadmapCanvas({ detail, view, root, onOpen, height }: RoadmapCanvasProps) {
	const board = useMemo(
		() => buildRoadmapBoard(detail.items, { expandCompleted: view === "graph" }),
		[detail.items, view],
	);
	const relations = useMemo(() => toBoardRelations(detail.relations), [detail.relations]);
	return (
		<Canvas locale="zh-CN" fit={{ minScale: 0.5, padding: FIT_PADDING }} style={{ height }}>
			{/* 顶部留出缩放工具栏的高度，适应窗口时内容不被它压住。 */}
			<div className="pt-11">
				{view === "graph" ? (
					<RelationGraph
						columns={board.columns}
						cards={detail.items}
						order={board.order}
						relations={relations}
						rootId={root?.id}
						cardSize={NODE}
						locale="zh-CN"
						getCardLabel={label}
						renderCard={(item) => <GraphNode item={item} onOpen={onOpen} />}
					/>
				) : (
					<Board
						columns={board.columns}
						cards={detail.items}
						order={board.order}
						relations={relations}
						locale="zh-CN"
						getCardLabel={label}
						renderCard={(item) => <RoadmapCardContent item={item} onOpen={onOpen} />}
					/>
				)}
			</div>
		</Canvas>
	);
}
