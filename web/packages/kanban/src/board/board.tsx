import { type HTMLAttributes, type ReactNode, useId, useMemo, useRef } from "react";
import {
	type AutoSortEntry,
	type BoardCard,
	type BoardMove,
	type BoardState,
	resolveBoard,
} from "../core/index.ts";
import { CardItem } from "./card-item.tsx";
import type { Activity } from "./drag/activity.ts";
import { PLACEHOLDER_FLIP_ID } from "./drag/dom.ts";
import { useFlip } from "./drag/motion.ts";
import type { DragController } from "./drag/types.ts";
import { useAnnouncer } from "./drag/use-announcer.ts";
import { useBoardDrag } from "./drag/use-board-drag.ts";
import { type MoveDecision, useBoardMoves } from "./drag/use-board-moves.ts";
import { useFocusRequest } from "./drag/use-focus-request.ts";
import { useKeyboardMove } from "./drag/use-keyboard-move.ts";
import {
	type BoardLocale,
	type BoardMessages,
	formatMessage,
	resolveMessages,
} from "./messages.ts";

/** 列定义。`title` 同时是列分组的可访问名称。 */
export interface BoardColumn {
	id: string;
	title?: string;
	/**
	 * 自动排序列：顺序由使用方决定，列内不能手动重排，别的列的卡片进入时先显示在这一端。
	 * @default undefined 普通列
	 */
	autoSort?: AutoSortEntry;
}

/**
 * 看板属性。除下列字段外，其余 `div` 属性（`className`、`data-*`、`aria-label` 等）落在根节点。
 *
 * @typeParam TCard - 卡片类型，只要求有 id
 * @typeParam TColumn - 列类型，只要求有 id 与可选 title
 */
export interface BoardProps<TCard extends BoardCard, TColumn extends BoardColumn = BoardColumn>
	extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
	/** 列定义，数组顺序即从左到右的列顺序。 */
	columns: readonly TColumn[];
	/** 卡片池，顺序无关；只要求有 id。 */
	cards: readonly TCard[];
	/** 列 id → 该列内从上到下的卡片 id。 */
	order: BoardState["order"];
	/**
	 * 渲染卡片内容。
	 *
	 * 可拖动的看板在拖拽时会再为浮起的卡片渲染一次，所以内容里不要依赖唯一的 DOM id，也不要让副作用只能执行一次。
	 */
	renderCard: (card: TCard, context: { column: TColumn; index: number }) => ReactNode;
	/** 取代默认列头（标题与卡片数）。`title` 仍作为列分组的可访问名称。 */
	renderColumnHeader?: (column: TColumn, context: { count: number }) => ReactNode;
	/** 取代列内没有卡片时的默认提示；返回 `null` 则不显示任何提示。 */
	renderEmpty?: (column: TColumn) => ReactNode;
	/**
	 * 提交一次移动。提供它即让看板可编辑。
	 *
	 * 放下后看板先按新顺序显示，直到这次调用完成；返回的 Promise 被拒绝（或同步抛错）时回滚并触发 `onMoveError`。
	 * 完成之后只认 `order`，所以要在完成前更新它（例如在 `onMove` 里乐观更新，或等保存成功后再返回）。
	 */
	onMove?: (move: BoardMove) => void | Promise<void>;
	/**
	 * 判断一次移动是否允许，落点变化与放下时调用，放下时按最终位置重新判断。
	 * 拒绝时占位标记为不可放置，放下后卡片回到原位并提示原因；抛错按拒绝处理。
	 * 自动排序列内的手动重排由看板先行拒绝。
	 */
	canMove?: (move: BoardMove) => MoveDecision;
	/** `onMove` 失败并已回滚时调用。 */
	onMoveError?: (error: unknown, move: BoardMove) => void;
	/** 逐卡片禁用拖动。 */
	isDraggable?: (card: TCard) => boolean;
	/** 即使提供了 `onMove` 也不允许拖动。 */
	readOnly?: boolean;
	/**
	 * 卡片的文字名称，用于键盘播报与「移到…」菜单的可访问名称。
	 * @default (card) => card.id
	 */
	getCardLabel?: (card: TCard) => string;
	/** 替换拖拽控制器，默认是指针控制器。身份变化会重新挂载并取消进行中的拖拽，请保持引用稳定。 */
	dragController?: DragController;
	/** 内置文案的语言。 */
	locale?: BoardLocale;
	/** 覆盖内置文案，只需给出要改的键。 */
	messages?: Partial<BoardMessages>;
}

/**
 * 受控看板：按使用方给出的列与顺序排布卡片。
 *
 * 不提供 `onMove` 时只读；提供后用户可用鼠标、笔、触屏或键盘移动卡片，看板不持有数据，只报告移动。
 *
 * @typeParam TCard - 卡片类型，只要求有 id
 * @typeParam TColumn - 列类型，只要求有 id 与可选 title
 */
export function Board<TCard extends BoardCard, TColumn extends BoardColumn = BoardColumn>({
	columns,
	cards,
	order,
	renderCard,
	renderColumnHeader,
	renderEmpty,
	onMove,
	canMove,
	onMoveError,
	isDraggable,
	readOnly,
	getCardLabel,
	dragController,
	locale,
	messages: messageOverrides,
	className,
	...rest
}: BoardProps<TCard, TColumn>) {
	const messages = resolveMessages(locale, messageOverrides);
	const definitions = new Map<string, TColumn>();
	for (const column of columns)
		if (!definitions.has(column.id)) definitions.set(column.id, column);
	const columnIds = columns.map((column) => column.id);
	const cardsById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
	const autoSort = (id: string) => definitions.get(id)?.autoSort;
	const columnTitle = (id: string) => definitions.get(id)?.title ?? id;
	const cardLabel = (id: string) => {
		const card = cardsById.get(id);
		return card ? (getCardLabel?.(card) ?? card.id) : id;
	};

	const rootRef = useRef<HTMLDivElement>(null);
	const scrollerRef = useRef<HTMLDivElement>(null);
	const activity = useRef<Activity>(null);
	const hintId = useId();
	const moves = useBoardMoves({
		columnIds,
		order,
		autoSort,
		onMove,
		canMove,
		onMoveError,
		readOnly,
		messages,
	});
	const focus = useFocusRequest(rootRef);
	const { announcement, announce } = useAnnouncer({ moves, cardLabel, columnTitle, messages });
	const keyboard = useKeyboardMove({
		rootRef,
		moves,
		columnIds,
		autoSort,
		messages,
		activity,
		announce,
		focus,
	});
	const drag = useBoardDrag({ rootRef, moves, autoSort, controller: dragController, activity });

	const resolved = resolveBoard({ columns: columnIds, order: keyboard.order }, cards);
	useFlip(
		scrollerRef,
		`${JSON.stringify(columnIds.map((id) => [id, keyboard.order[id] ?? []]))}|${drag.layoutKey}`,
		moves.editable,
	);
	const ghostCard = drag.ghost ? cardsById.get(drag.ghost.cardId) : undefined;

	return (
		<div
			ref={rootRef}
			role="group"
			aria-label={messages.boardLabel}
			className={className ? `v-kanban ${className}` : "v-kanban"}
			data-dragging={drag.dragging ? "true" : undefined}
			{...rest}
		>
			<div ref={scrollerRef} className="v-kanban__scroller">
				{resolved.map(({ id, cards: columnCards }) => {
					const column = definitions.get(id) as TColumn;
					const title = column.title ?? column.id;
					const placeholder = drag.dragging?.placeholder;
					const dragged = drag.dragging?.cardId;
					const placeholderNode =
						drag.dragging && placeholder?.columnId === id ? (
							<li
								// 随位置变化的 key：占位移动时 React 只增删它自己，不会挪动被按下的卡片节点
								key={`placeholder-${placeholder.index}`}
								aria-hidden="true"
								className="v-kanban__placeholder"
								data-placeholder="true"
								data-flip={PLACEHOLDER_FLIP_ID}
								data-invalid={drag.dragging.invalid ? "true" : undefined}
								style={{ height: drag.dragging.size.height }}
							/>
						) : null;
					const items: ReactNode[] = [];
					let shown = 0;
					for (const [index, card] of columnCards.entries()) {
						// 被拖卡片留在原处隐藏：触屏手势的后续事件固定发给按下时的节点，节点一脱离文档就收不到了
						const isOrigin = card.id === dragged;
						if (!isOrigin && shown === placeholder?.index && placeholderNode)
							items.push(placeholderNode);
						items.push(
							<CardItem
								key={card.id}
								cardId={card.id}
								origin={isOrigin}
								draggable={moves.editable && isDraggable?.(card) !== false}
								lifted={keyboard.liftedId === card.id}
								settling={card.id === drag.settlingId}
								hintId={hintId}
								onKeyDown={(event) => keyboard.onCardKeyDown(event, card.id)}
							>
								{renderCard(card, { column, index })}
							</CardItem>,
						);
						if (!isOrigin) shown += 1;
					}
					if (placeholderNode && shown === placeholder?.index)
						items.push(placeholderNode);
					const hasVisible = shown > 0 || placeholderNode !== null;
					return (
						<div
							key={id}
							role="group"
							className="v-kanban__column"
							aria-label={title}
							data-column-id={id}
						>
							{renderColumnHeader ? (
								renderColumnHeader(column, { count: columnCards.length })
							) : (
								<header className="v-kanban__column-header">
									<h3 className="v-kanban__column-title">{title}</h3>
									<span className="v-kanban__count">
										<span aria-hidden="true">{columnCards.length}</span>
										<span className="v-kanban__sr-only">
											{formatMessage(messages.cardCount, {
												count: columnCards.length,
											})}
										</span>
									</span>
								</header>
							)}
							{items.length > 0 ? (
								// biome-ignore lint/a11y/noRedundantRoles: 显式 role：list-style: none 会让 Safari 丢弃列表语义
								<ul role="list" className="v-kanban__cards">
									{items}
								</ul>
							) : null}
							{hasVisible ? null : renderEmpty ? (
								renderEmpty(column)
							) : (
								<p className="v-kanban__empty">{messages.emptyColumn}</p>
							)}
						</div>
					);
				})}
			</div>
			{drag.ghost && ghostCard ? (
				<div
					ref={drag.ghostRef}
					aria-hidden="true"
					inert
					className="v-kanban__card v-kanban__ghost"
					style={{ width: drag.ghost.size.width, height: drag.ghost.size.height }}
				>
					{renderCard(ghostCard, {
						column: definitions.get(drag.ghost.origin.columnId) as TColumn,
						index: drag.ghost.origin.index,
					})}
				</div>
			) : null}
			{moves.editable ? (
				<>
					<span id={hintId} className="v-kanban__sr-only">
						{messages.keyboardHint}
					</span>
					<div
						role="status"
						aria-live="polite"
						aria-atomic="true"
						className="v-kanban__sr-only v-kanban__announcer"
					>
						<span key={announcement.seq}>{announcement.text}</span>
					</div>
				</>
			) : null}
			<div
				role="status"
				className="v-kanban__notice"
				data-empty={moves.notice ? undefined : "true"}
			>
				<span key={moves.noticeSeq}>{moves.notice}</span>
			</div>
		</div>
	);
}
