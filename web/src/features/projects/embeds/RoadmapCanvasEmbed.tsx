import { DeferredContent } from "@shared/ui/deferred-content/DeferredContent";
import type { ReactNode } from "react";
import type { RoadmapDetail, RoadmapItem } from "../model/roadmap";

/** 文章里画布的高度：放得下一屏内容，又不至于让读者滚很久才离开它。 */
const HEIGHT = "28rem";

/** SSR 保留标题与固定高度，画布依赖在接近视口时准备。 */
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

const loadCanvas = () =>
	import("./RoadmapCanvas").then((module) => ({ default: module.RoadmapCanvas }));

/**
 * 保留路线图标题与画布占位，在接近视口时加载交互画布。
 *
 * @remarks SSR 与首次客户端渲染使用相同高度；完成后滚出视口不卸载画布。
 */
export function RoadmapCanvasEmbed({
	detail,
	view,
	root,
	onOpen,
	header,
}: RoadmapCanvasEmbedProps) {
	return (
		<>
			{header}
			<div className="roadmap-board mt-4">
				<DeferredContent
					load={loadCanvas}
					componentProps={{ detail, view, root, onOpen, height: HEIGHT }}
					label="路线图画布"
					fallback={
						<div
							style={{ height: HEIGHT }}
							className="grid place-items-center rounded-xl bg-muted/40 text-sm text-muted-foreground"
						>
							正在加载画布…
						</div>
					}
				/>
			</div>
		</>
	);
}
