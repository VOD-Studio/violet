import { Button, Checkbox } from "@violet/ui";
import { Canvas } from "@violetjs/kanban/canvas";
import { Board, ResponsiveLayout } from "@violetjs/kanban/unstyled";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
	buildRoadmapBoard,
	COMPLETED_PREVIEW_LIMIT,
	type RoadmapColumn,
	shownItemIds,
	toBoardRelations,
} from "../lib/roadmap-board";
import type { RoadmapItem, RoadmapRelation } from "../model/roadmap";
import { RoadmapCardContent } from "./RoadmapCardContent";

export interface RoadmapBoardProps {
	/** 后端按展示顺序给出的全部条目。 */
	items: readonly RoadmapItem[];
	/** 条目之间的关系。 */
	relations: readonly RoadmapRelation[];
	/** 打开条目详情；`trigger` 是被点击的按钮，弹窗关闭后焦点要还给它。 */
	onOpenItem: (item: RoadmapItem, trigger: HTMLElement) => void;
}

/**
 * 三阶段只读看板：宽屏是可平移缩放全屏的画布，窄屏是一次显示一个阶段的切换器。
 *
 * 宽屏上关系线常显，点击条目会选中它：相关的条目与线保持清晰，其余淡化，也可以整体隐藏连线；
 * 窄屏没有线，关系用卡片上的标记表达。已完成阶段默认只显示最近的条目，列底的按钮展开全部。
 */
export function RoadmapBoard({ items, relations, onOpenItem }: RoadmapBoardProps) {
	const [expanded, setExpanded] = useState(false);
	// 显示的阶段由这里持有：宽窄布局切换会重新挂载看板，不持有就回到第一个阶段
	const [activeColumn, setActiveColumn] = useState<string>();
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [linesHidden, setLinesHidden] = useState(false);
	const toggleId = useId();
	const board = useMemo(
		() => buildRoadmapBoard(items, { expandCompleted: expanded }),
		[items, expanded],
	);
	const boardRelations = useMemo(() => toBoardRelations(relations), [relations]);
	// 选中的条目被收起时不再显示：不然其余条目全被淡化，却看不到被选中的是谁
	const selected = useMemo(() => {
		if (selectedId === null) return null;
		return shownItemIds(board).has(selectedId)
			? (items.find((item) => item.id === selectedId) ?? null)
			: null;
	}, [selectedId, board, items]);
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
		relations: boardRelations,
		locale: "zh-CN" as const,
		getCardLabel: (item: RoadmapItem) => `#${item.number} ${item.title}`,
		renderCard: (item: RoadmapItem) => (
			<RoadmapCardContent
				item={item}
				onOpen={(opened, trigger) => {
					// 打开详情的同时选中：弹窗关闭后，画布上就是这条的脉络
					setSelectedId(opened.id);
					onOpenItem(opened, trigger);
				}}
			/>
		),
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
				{relations.length > 0 ? (
					<div className="mb-3 flex min-h-8 flex-wrap items-center justify-between gap-x-4 gap-y-2">
						<p aria-live="polite" className="text-sm text-muted-foreground">
							{selected ? (
								<>
									已选中 <span className="font-mono">#{selected.number}</span>
									，相关条目与连线保持清晰{" "}
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => setSelectedId(null)}
									>
										取消选中
									</Button>
								</>
							) : (
								"点击条目查看详情，并突出它的关系"
							)}
						</p>
						<label
							htmlFor={toggleId}
							className="flex cursor-pointer items-center gap-2 text-sm"
						>
							<Checkbox
								id={toggleId}
								checked={linesHidden}
								onCheckedChange={(checked) => setLinesHidden(checked === true)}
							/>
							隐藏连线
						</label>
					</div>
				) : null}
				<Canvas locale="zh-CN" style={{ height: "min(75dvh, 44rem)" }}>
					<Board
						{...shared}
						hideRelations={linesHidden}
						selectedCardId={selected?.id ?? null}
						onSelectedCardChange={setSelectedId}
					/>
				</Canvas>
			</ResponsiveLayout>
		</div>
	);
}
