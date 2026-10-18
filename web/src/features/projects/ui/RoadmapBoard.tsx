import { Button } from "@violet/ui";
import { Canvas } from "@violetjs/kanban/canvas";
import { Board, ResponsiveLayout } from "@violetjs/kanban/unstyled";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	buildRoadmapBoard,
	COMPLETED_PREVIEW_LIMIT,
	type RoadmapColumn,
} from "../lib/roadmap-board";
import type { RoadmapItem } from "../model/roadmap";
import { RoadmapCardContent } from "./RoadmapCardContent";

export interface RoadmapBoardProps {
	/** 后端按展示顺序给出的全部条目。 */
	items: readonly RoadmapItem[];
	/** 打开条目详情；`trigger` 是被点击的按钮，弹窗关闭后焦点要还给它。 */
	onOpenItem: (item: RoadmapItem, trigger: HTMLElement) => void;
}

/**
 * 三阶段只读看板：宽屏是可平移缩放全屏的画布，窄屏是一次显示一个阶段的切换器。
 *
 * 已完成阶段默认只显示最近的条目，列底的按钮展开全部。
 */
export function RoadmapBoard({ items, onOpenItem }: RoadmapBoardProps) {
	const [expanded, setExpanded] = useState(false);
	// 显示的阶段由这里持有：宽窄布局切换会重新挂载看板，不持有就回到第一个阶段
	const [activeColumn, setActiveColumn] = useState<string>();
	const board = useMemo(
		() => buildRoadmapBoard(items, { expandCompleted: expanded }),
		[items, expanded],
	);
	const root = useRef<HTMLDivElement>(null);
	// 展开后按钮被新露出的条目挤到下面，焦点留在原处会落到视野之外：把焦点交给第一条新露出的卡片
	const focusAfterExpand = useRef<string | null>(null);
	useEffect(() => {
		const id = focusAfterExpand.current;
		focusAfterExpand.current = null;
		if (!expanded || id === null) return;
		root.current
			?.querySelector<HTMLElement>(`[data-card-id="${CSS.escape(id)}"] button`)
			?.focus();
	}, [expanded]);

	const shared = {
		columns: board.columns,
		cards: items,
		order: board.order,
		locale: "zh-CN" as const,
		getCardLabel: (item: RoadmapItem) => `#${item.number} ${item.title}`,
		renderCard: (item: RoadmapItem) => <RoadmapCardContent item={item} onOpen={onOpenItem} />,
		renderColumnFooter: (column: RoadmapColumn) =>
			column.id === "completed" && board.completedTotal > COMPLETED_PREVIEW_LIMIT ? (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					aria-expanded={expanded}
					className="w-full"
					onClick={() => {
						if (!expanded) focusAfterExpand.current = board.firstHiddenCompletedId;
						setExpanded((value) => !value);
					}}
				>
					{expanded ? "收起" : `展开更多（还有 ${board.hiddenCompleted} 条）`}
				</Button>
			) : null,
	};

	return (
		<div ref={root}>
			<ResponsiveLayout
				narrow={
					<Board
						{...shared}
						layout="switcher"
						activeColumn={activeColumn}
						onActiveColumnChange={setActiveColumn}
					/>
				}
			>
				<Canvas locale="zh-CN" style={{ height: "min(75dvh, 44rem)" }}>
					<Board {...shared} />
				</Canvas>
			</ResponsiveLayout>
		</div>
	);
}
