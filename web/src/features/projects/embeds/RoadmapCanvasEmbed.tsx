import { useHydrated } from "@tanstack/react-router";
import { Canvas } from "@violetjs/kanban/canvas";
import { RelationGraph } from "@violetjs/kanban/graph";
import { Board } from "@violetjs/kanban/unstyled";
import { type ReactNode, useMemo } from "react";
import { buildRoadmapBoard, toBoardRelations } from "../lib/roadmap-board";
import type { RoadmapDetail, RoadmapItem } from "../model/roadmap";
import { RoadmapCardContent } from "../ui/RoadmapCardContent";
import "../ui/roadmap-board.css";

/** 文章里画布的高度：放得下一屏内容，又不至于让读者滚很久才离开它。 */
const HEIGHT = "28rem";
/**
 * 适应窗口时四周的留白（px）。工具栏浮在画布右上角，内容顶部另有 pt-11 的留白，
 * 但它会随缩放变小：最小 50% 时只剩 22px，加上这 32px 才高过工具栏。
 */
const FIT_PADDING = 32;
/** 关系图节点的尺寸：编号与两行标题。 */
const NODE = { width: 240, height: 76 };

export interface RoadmapCanvasEmbedProps {
	detail: RoadmapDetail;
	/** board 是三阶段看板，graph 是关系图 */
	view: "board" | "graph";
	/** 关系图以它为根；省略时是整个项目 */
	root?: RoadmapItem;
	/** 打开条目的只读详情 */
	onOpen: (item: RoadmapItem, trigger: HTMLElement) => void;
	/** 画布上方的标题行 */
	header: ReactNode;
}

const label = (item: RoadmapItem) => `#${item.number} ${item.title}`;

/** 关系图里的节点：编号与标题，点开看详情。 */
function GraphNode({
	item,
	onOpen,
}: {
	item: RoadmapItem;
	onOpen: RoadmapCanvasEmbedProps["onOpen"];
}) {
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

/**
 * 文章里的路线图画布：三阶段看板或关系图，可平移缩放、全屏。
 *
 * 只在客户端加载：服务端渲染与水合首帧是同样高度的占位，挂载后再画画布，文章不会跳动。
 * 普通滚轮仍滚动页面，Ctrl/⌘ 加滚轮才缩放画布。
 */
export function RoadmapCanvasEmbed({
	detail,
	view,
	root,
	onOpen,
	header,
}: RoadmapCanvasEmbedProps) {
	const hydrated = useHydrated();
	const board = useMemo(
		() => buildRoadmapBoard(detail.items, { expandCompleted: view === "graph" }),
		[detail.items, view],
	);
	const relations = useMemo(() => toBoardRelations(detail.relations), [detail.relations]);

	return (
		<>
			{header}
			<div className="roadmap-board mt-4">
				{hydrated ? (
					<Canvas
						locale="zh-CN"
						fit={{ minScale: 0.5, padding: FIT_PADDING }}
						style={{ height: HEIGHT }}
					>
						{/* 顶部留出缩放工具栏的高度，适应窗口时内容不被它压住 */}
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
									renderCard={(item) => (
										<RoadmapCardContent item={item} onOpen={onOpen} />
									)}
								/>
							)}
						</div>
					</Canvas>
				) : (
					<div
						style={{ height: HEIGHT }}
						className="grid place-items-center rounded-xl bg-muted/40 text-sm text-muted-foreground"
					>
						正在加载画布…
					</div>
				)}
			</div>
		</>
	);
}
