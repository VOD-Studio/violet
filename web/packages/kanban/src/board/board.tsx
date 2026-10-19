import { type HTMLAttributes, type ReactNode, useId, useMemo, useRef } from "react";
import {
	type AutoSortEntry,
	type BoardCard,
	type BoardMove,
	type BoardState,
	createAdjacency,
	type Relation,
	resolveBoard,
} from "../core/index.ts";
import { formatMessage } from "../locale.ts";
import { notifyEditing } from "../pan-region.ts";
import { CardContent, CardItem } from "./card-item.tsx";
import { ColumnView } from "./column.tsx";
import { ColumnSwitcher, switcherTabId } from "./column-switcher.tsx";
import type { Activity } from "./drag/activity.ts";
import { PLACEHOLDER_FLIP_ID } from "./drag/dom.ts";
import { useFlip } from "./drag/motion.ts";
import type { DragController } from "./drag/types.ts";
import { useAnnouncer } from "./drag/use-announcer.ts";
import { useBoardDrag } from "./drag/use-board-drag.ts";
import { type MoveDecision, useBoardMoves } from "./drag/use-board-moves.ts";
import { useFocusRequest } from "./drag/use-focus-request.ts";
import { useKeyboardMove } from "./drag/use-keyboard-move.ts";
import { useMoveMenu } from "./drag/use-move-menu.ts";
import { BoardLocaleContext } from "./locale-context.ts";
import { type BoardLocale, type BoardMessages, resolveMessages } from "./messages.ts";
import { BoardRelationLayer } from "./relations/board-relation-layer.tsx";
import { relationEntries, relationsSummary } from "./relations/entries.ts";
import { type RelationTypeStyle, resolveRelationTypes } from "./relations/types.ts";
import { useActiveColumn } from "./use-active-column.ts";
import { useArrival } from "./use-arrival.ts";
import { useCollapsedColumns } from "./use-collapsed.ts";

/** 点击这些元素是点在空白处：用来取消选中。 */
const EMPTY_SPACE =
	".v-kanban__column, .v-kanban__column-body, .v-kanban__column-body-inner, .v-kanban__cards, .v-kanban__empty";

/** 列显示的卡片总数：`total` 是有限数时取它，但不小于实际提供的张数。 */
function columnTotal(column: BoardColumn | undefined, shown: number) {
	const total = column?.total;
	return total !== undefined && Number.isFinite(total)
		? Math.max(Math.floor(total), shown)
		: shown;
}

/** 列定义。`title` 同时是列分组的可访问名称。 */
export interface BoardColumn {
	id: string;
	title?: string;
	/**
	 * 自动排序列：顺序由使用方决定，列内不能手动重排，别的列的卡片进入时先显示在这一端。
	 * @default undefined 普通列
	 */
	autoSort?: AutoSortEntry;
	/**
	 * 看板开启 `collapsible` 时，这一列是否可折叠；`false` 让这一列不可折叠。
	 * @default undefined 跟随看板
	 */
	collapsible?: boolean;
	/**
	 * 提供 `onAddCard` 时，这一列是否有列底快速添加；`false` 关闭这一列的入口。
	 * @default undefined 跟随看板
	 */
	quickAdd?: boolean;
	/**
	 * 列的卡片总数。只提供了列内一部分卡片（例如「展开更多」之前）时设置：列头、切换器标签与读屏的数量取它，
	 * 而不是提供的张数。小于提供的张数时忽略；`filter` 只作用于提供的卡片，所以隐藏的卡片不计入匹配数。
	 * @default undefined 提供的卡片数
	 */
	total?: number;
}

/** 快速添加提交的新卡片：所在列与标题。 */
export interface NewCard {
	columnId: string;
	title: string;
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
	renderColumnHeader?: (
		column: TColumn,
		context: { count: number; matched: number | null },
	) => ReactNode;
	/** 取代列内没有卡片时的默认提示；返回 `null` 则不显示任何提示。 */
	renderEmpty?: (column: TColumn) => ReactNode;
	/**
	 * 列内卡片之后的内容，例如「展开更多」。`count` 是列的卡片总数（设置了 `column.total` 时取它），
	 * `shown` 是提供并正在显示的张数；返回 `null` 不显示。折叠的列里不可交互。
	 */
	renderColumnFooter?: (column: TColumn, context: { count: number; shown: number }) => ReactNode;
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
	/**
	 * 每张可拖动卡片上的「移到…」菜单，是拖拽的单指针替代：选择目标列即移到该列的入口端或末尾。
	 * `"hover"` 在悬停或聚焦卡片时显示（无悬停的触屏设备上常显），`"always"` 常显，`"none"` 关闭。
	 * @default "hover"
	 */
	moveMenu?: "hover" | "always" | "none";
	/**
	 * 列可折叠：列头出现折叠按钮，折叠后只剩列头与计数。列可用 `column.collapsible: false` 单独退出。
	 * @default false
	 */
	collapsible?: boolean;
	/** 受控的折叠列 id；给出后以它为准，点击只通过 `onCollapsedColumnsChange` 通知。 */
	collapsedColumns?: readonly string[];
	/** 非受控时的初始折叠列 id。 */
	defaultCollapsedColumns?: readonly string[];
	/** 折叠状态变化时调用，参数是完整的折叠列 id。卡片被移到折叠的列时，该列会自动展开并通知。 */
	onCollapsedColumnsChange?: (collapsed: string[]) => void;
	/**
	 * 列底快速添加：只填标题，保存由使用方负责。提供它即显示入口（只读看板除外）。
	 *
	 * 返回的 Promise 被拒绝（或同步抛错）表示保存失败：保留已输入的标题、显示错误并触发 `onAddCardError`。
	 */
	onAddCard?: (card: NewCard) => void | Promise<void>;
	/** `onAddCard` 失败时调用。 */
	onAddCardError?: (error: unknown, card: NewCard) => void;
	/**
	 * 筛选谓词：不匹配的卡片淡化并保持原位。提供它即表示筛选生效，此时整板禁用移动
	 * （拖拽、键盘、「移到…」菜单）并给出提示；不筛选时传 `undefined`。谓词抛错的卡片按匹配处理。
	 */
	filter?: (card: TCard) => boolean;
	/**
	 * 卡片之间带类型的关系，读作「来源 类型 目标」。看板画出关系线，线随拖拽、滚动和画布的缩放平移保持连接，
	 * 并给每张有关系的卡片加一段读屏的文字描述。端点不可见（在折叠的列里、卡片不存在）的关系不画线。
	 */
	relations?: readonly Relation[];
	/**
	 * 关系类型的读法与线型，与内置的 `extends`（实线）、`fixes`（虚线）、`blocks`（实线加挡条）合并。
	 * 没有映射的类型按实线处理，类型名当文字。
	 */
	relationTypes?: Readonly<Record<string, RelationTypeStyle>>;
	/**
	 * 隐藏关系线；卡片上的文字描述仍在。
	 * @default false
	 */
	hideRelations?: boolean;
	/**
	 * 选中的卡片：它和直接相连的卡片保持清晰，其余卡片与关系线淡化。受控，给出后点击只通过
	 * `onSelectedCardChange` 通知。
	 */
	selectedCardId?: string | null;
	/**
	 * 选中变化：点击卡片（再点一次取消，点空白处取消）；不可拖的卡片可聚焦，用 Enter 或空格；
	 * 可拖的卡片用 Alt+Enter。点击卡片里的按钮、链接、输入框不算。提供它即启用选中。
	 */
	onSelectedCardChange?: (cardId: string | null) => void;
	/**
	 * 布局。`"columns"` 把各列并排；`"switcher"` 为窄屏准备：顶部是列切换器，一次只显示一列，
	 * 不画关系线，折叠不适用，「移到…」菜单常显，因为跨列移动只能走菜单或键盘。
	 * 按容器宽度自动切换见 `ResponsiveLayout`。
	 * @default "columns"
	 */
	layout?: "columns" | "switcher";
	/** 列切换布局当前显示的列 id；受控，给出后点击标签只通过 `onActiveColumnChange` 通知。 */
	activeColumn?: string;
	/**
	 * 非受控时列切换布局初始显示的列 id。
	 * @default undefined 第一列
	 */
	defaultActiveColumn?: string;
	/** 列切换布局显示的列变化时调用，包括点击标签，以及移动卡片后切到卡片所在的列。 */
	onActiveColumnChange?: (columnId: string) => void;
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
	renderColumnFooter,
	onMove,
	canMove,
	onMoveError,
	isDraggable,
	readOnly,
	getCardLabel,
	moveMenu = "hover",
	collapsible = false,
	collapsedColumns,
	defaultCollapsedColumns,
	onCollapsedColumnsChange,
	onAddCard,
	onAddCardError,
	filter,
	relations,
	relationTypes: relationTypeOverrides,
	hideRelations = false,
	selectedCardId = null,
	onSelectedCardChange,
	layout = "columns",
	activeColumn,
	defaultActiveColumn,
	onActiveColumnChange,
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
	const selectHintId = useId();
	const selectHintDragId = useId();
	const collapse = useCollapsedColumns({
		collapsed: collapsedColumns,
		defaultCollapsed: defaultCollapsedColumns,
		onChange: onCollapsedColumnsChange,
	});
	const switcher = layout === "switcher";
	const active = useActiveColumn({
		columnIds,
		active: activeColumn,
		defaultActive: defaultActiveColumn,
		onChange: onActiveColumnChange,
	});
	// 卡片的位置进入一列：折叠的列展开，一次只显示一列的布局切到这一列，焦点才能跟着卡片进去
	const enterColumn = switcher ? active.select : collapse.expand;
	const filterActive = filter !== undefined;
	// 每张卡片每次渲染只问一次谓词；淡化与列计数共用这份结果。谓词抛错的卡片按匹配处理
	const matchedIds = filter
		? new Set(
				cards.flatMap((card) => {
					try {
						return filter(card) ? [card.id] : [];
					} catch {
						return [card.id];
					}
				}),
			)
		: null;
	const matches = (card: TCard) => matchedIds === null || matchedIds.has(card.id);
	/** 用户在看板里操作：外层画布不再随内容尺寸变化自动适应。 */
	const engage = () => {
		if (rootRef.current) notifyEditing(rootRef.current);
	};
	const moves = useBoardMoves({
		columnIds,
		order,
		autoSort,
		// 移到折叠的列时先把它展开，免得卡片落进看不见的地方；列切换布局没有折叠
		onMove:
			onMove &&
			((move) => {
				if (!switcher) collapse.expand(move.to.columnId);
				return onMove(move);
			}),
		canMove,
		onMoveError,
		readOnly: readOnly || filterActive,
		messages,
	});
	const showFilterHint = filterActive && Boolean(onMove) && !readOnly;
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
		onEnterColumn: enterColumn,
	});
	const drag = useBoardDrag({ rootRef, moves, autoSort, controller: dragController, activity });
	const moveToColumn = useMoveMenu({
		moves,
		autoSort,
		announce,
		focus,
		onEnterColumn: switcher ? active.select : undefined,
	});

	const resolved = resolveBoard({ columns: columnIds, order: keyboard.order }, cards);
	const layoutVersion = `${JSON.stringify(columnIds.map((id) => [id, keyboard.order[id] ?? []]))}|${drag.layoutKey}`;
	useFlip(scrollerRef, layoutVersion, moves.editable);

	// 关系：两端都是已知卡片的才算；选中与高亮、读屏描述、关系线共用这份结果
	const relationTypes = resolveRelationTypes(locale, relationTypeOverrides);
	const knownRelations = (relations ?? []).filter(
		(relation) => cardsById.has(relation.sourceId) && cardsById.has(relation.targetId),
	);
	const adjacency = createAdjacency(knownRelations);
	const selectedId =
		selectedCardId !== null && cardsById.has(selectedCardId) ? selectedCardId : null;
	const neighborIds = selectedId === null ? null : new Set(adjacency.neighbors(selectedId));
	const entriesOf = (id: string) => relationEntries(adjacency, id, relationTypes, cardLabel);
	const relationsText = (id: string) => relationsSummary(entriesOf(id), messages);
	const relationMarkers = (id: string) =>
		entriesOf(id).map((entry) => ({
			...entry,
			label: formatMessage(messages.relationJump, { relation: entry.text }),
		}));
	// 跳转到关系另一端的卡片：先切到它所在的列，再聚焦并滚到视口中央，并短暂强调
	const { arrivedId, arrive } = useArrival();
	const jumpTo = (cardId: string) => {
		const column = resolved.find(({ cards: columnCards }) =>
			columnCards.some((item) => item.id === cardId),
		);
		if (!column) return;
		active.select(column.id);
		focus.reveal(cardId);
		arrive(cardId);
	};
	const showRelationLines = !switcher && !hideRelations && knownRelations.length > 0;
	const targets = [...definitions.values()].map((column) => ({
		id: column.id,
		title: column.title ?? column.id,
	}));
	const ghostCard = drag.ghost ? cardsById.get(drag.ghost.cardId) : undefined;
	const switcherId = useId();
	const panelId = `${switcherId}-panel`;
	const shown = switcher ? resolved.filter(({ id }) => id === active.current) : resolved;

	return (
		<BoardLocaleContext value={locale}>
			<div
				ref={rootRef}
				role="group"
				aria-label={messages.boardLabel}
				className={className ? `v-kanban ${className}` : "v-kanban"}
				data-layout={switcher ? "switcher" : undefined}
				data-dragging={drag.dragging ? "true" : undefined}
				{...rest}
			>
				{onMove && !readOnly ? (
					<p
						role="status"
						className={
							showFilterHint
								? "v-kanban__filter-hint"
								: "v-kanban__filter-hint v-kanban__sr-only"
						}
						data-empty={showFilterHint ? undefined : "true"}
					>
						{showFilterHint ? messages.filterDragDisabled : ""}
					</p>
				) : null}
				{switcher && active.current !== undefined ? (
					<ColumnSwitcher
						columns={resolved.map(({ id, cards: columnCards }) => ({
							id,
							title: columnTitle(id),
							count: columnTotal(definitions.get(id), columnCards.length),
							matched: filterActive ? columnCards.filter(matches).length : null,
						}))}
						activeId={active.current}
						onSelect={active.select}
						panelId={panelId}
						idPrefix={switcherId}
						messages={messages}
					/>
				) : null}
				{/* biome-ignore lint/a11y/useKeyWithClickEvents: 点击空白处取消选中只是鼠标的便利，键盘有 Alt+Enter 与再次切换 */}
				<div
					ref={scrollerRef}
					className="v-kanban__scroller"
					// 关系线叠加层以滚动层为定位参照；写在行内，不依赖样式表
					style={showRelationLines ? { position: "relative" } : undefined}
					onClick={(event) => {
						if (selectedId === null || !onSelectedCardChange) return;
						// 只有点在空白处才取消：列头、按钮、卡片都有自己的点击含义
						const target = event.target as Element;
						if (target === event.currentTarget || target.matches(EMPTY_SPACE))
							onSelectedCardChange(null);
					}}
				>
					{shown.map(({ id, cards: columnCards }) => {
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
									columnId={id}
									origin={isOrigin}
									draggable={moves.editable && isDraggable?.(card) !== false}
									lifted={keyboard.liftedId === card.id}
									settling={card.id === drag.settlingId}
									dimmed={filterActive && !matches(card)}
									dimmedText={messages.filteredOut}
									selected={selectedId === card.id}
									related={neighborIds?.has(card.id) ?? false}
									faded={
										selectedId !== null &&
										selectedId !== card.id &&
										!neighborIds?.has(card.id)
									}
									selectable={onSelectedCardChange !== undefined}
									onSelect={() =>
										onSelectedCardChange?.(
											selectedId === card.id ? null : card.id,
										)
									}
									// 列切换布局里关系由可点击的标记表达，不再重复一段给读屏的汇总
									relationsText={switcher ? undefined : relationsText(card.id)}
									relationMarkers={
										switcher ? relationMarkers(card.id) : undefined
									}
									onJump={jumpTo}
									arrived={arrivedId === card.id}
									hintId={hintId}
									selectHintId={
										moves.editable && isDraggable?.(card) !== false
											? selectHintDragId
											: selectHintId
									}
									menu={
										moveMenu === "none"
											? undefined
											: {
													// 一次只显示一列时跨列移动只能走菜单，悬停才出现会让它难以发现
													mode:
														switcher && moveMenu === "hover"
															? "always"
															: moveMenu,
													label: formatMessage(messages.moveToLabel, {
														card: cardLabel(card.id),
													}),
													triggerText: messages.moveTo,
													targets,
													onSelect: (columnId) =>
														moveToColumn(card.id, columnId),
												}
									}
									onKeyDown={(event) => keyboard.onCardKeyDown(event, card.id)}
								>
									<CardContent
										card={card}
										column={column}
										index={index}
										render={renderCard}
									/>
								</CardItem>,
							);
							if (!isOrigin) shown += 1;
						}
						if (placeholderNode && shown === placeholder?.index)
							items.push(placeholderNode);
						const hasVisible = shown > 0 || placeholderNode !== null;
						const matched = filterActive ? columnCards.filter(matches).length : null;
						// 折叠列表只对可折叠的列起作用：否则列被藏起来，又没有按钮可以展开
						const columnCollapsible =
							!switcher && collapsible && column.collapsible !== false;
						const total = columnTotal(column, columnCards.length);
						return (
							<ColumnView
								key={id}
								id={id}
								title={title}
								count={total}
								matched={matched}
								renderHeader={
									renderColumnHeader
										? () =>
												renderColumnHeader(column, {
													count: total,
													matched,
												})
										: undefined
								}
								footer={
									renderColumnFooter
										? renderColumnFooter(column, {
												count: total,
												shown: columnCards.length,
											})
										: undefined
								}
								collapsible={columnCollapsible}
								collapsed={columnCollapsible && collapse.isCollapsed(id)}
								onToggle={() => {
									engage();
									collapse.toggle(id);
								}}
								quickAdd={
									onAddCard && !readOnly && column.quickAdd !== false
										? {
												onSubmit: (cardTitle) =>
													onAddCard({ columnId: id, title: cardTitle }),
												onError: (error, cardTitle) =>
													onAddCardError?.(error, {
														columnId: id,
														title: cardTitle,
													}),
												onOpen: engage,
											}
										: undefined
								}
								panel={
									switcher
										? { id: panelId, labelledBy: switcherTabId(switcherId, id) }
										: undefined
								}
								messages={messages}
							>
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
							</ColumnView>
						);
					})}
					{showRelationLines ? (
						<BoardRelationLayer
							relations={knownRelations}
							types={relationTypes}
							selectedId={selectedId}
							cardLabel={cardLabel}
							geometry={{
								ghostRef: drag.ghostRef,
								heldId: drag.ghost?.cardId ?? null,
								active: drag.ghost !== null || keyboard.liftedId !== null,
								version: `${layoutVersion}|${columnIds.filter(collapse.isCollapsed).join(",")}`,
							}}
						/>
					) : null}
				</div>
				{drag.ghost && ghostCard ? (
					<div
						ref={drag.ghostRef}
						aria-hidden="true"
						inert
						className="v-kanban__card v-kanban__ghost"
						style={{ width: drag.ghost.size.width, height: drag.ghost.size.height }}
					>
						<CardContent
							card={ghostCard}
							column={definitions.get(drag.ghost.origin.columnId) as TColumn}
							index={drag.ghost.origin.index}
							render={renderCard}
						/>
					</div>
				) : null}
				{onSelectedCardChange ? (
					<>
						<span id={selectHintId} className="v-kanban__sr-only">
							{messages.selectHint}
						</span>
						<span id={selectHintDragId} className="v-kanban__sr-only">
							{messages.selectHintDraggable}
						</span>
					</>
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
		</BoardLocaleContext>
	);
}
