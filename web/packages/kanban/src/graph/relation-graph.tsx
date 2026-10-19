import { type HTMLAttributes, type KeyboardEvent, type ReactNode, useId, useMemo } from "react";
import type { BoardColumn } from "../board/board.tsx";
import { OWN_CLICK } from "../board/card-item.tsx";
import { CountBadge } from "../board/count-badge.tsx";
import { type BoardLocale, type BoardMessages, resolveMessages } from "../board/messages.ts";
import { relationEntries, relationsSummary } from "../board/relations/entries.ts";
import { RelationLayer } from "../board/relations/relation-layer.tsx";
import { type RelationTypeStyle, resolveRelationTypes } from "../board/relations/types.ts";
import {
	type BoardCard,
	type BoardState,
	createAdjacency,
	DEFAULT_GRAPH_LAYOUT,
	layoutGraph,
	type Relation,
	relatedSubgraph,
	resolveBoard,
	type SubgraphOptions,
} from "../core/index.ts";

/** 点击这些元素是点在空白处：用来取消选中。 */
const EMPTY_SPACE = ".v-kanban-graph__zone, .v-kanban-graph__column, .v-kanban-graph__cards";

/**
 * 关系图属性。数据与 `Board` 同形（列、卡片池、每列顺序），可以直接共用同一份。
 * 其余 `div` 属性（`className`、`data-*`、`aria-label` 等）落在根节点。
 *
 * @typeParam TCard - 卡片类型，只要求有 id
 * @typeParam TColumn - 列类型，只要求有 id 与可选 title
 */
export interface RelationGraphProps<
	TCard extends BoardCard,
	TColumn extends BoardColumn = BoardColumn,
> extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
	/** 列定义，数组顺序即从左到右的分区顺序。 */
	columns: readonly TColumn[];
	/** 卡片池，顺序无关；只要求有 id。 */
	cards: readonly TCard[];
	/** 列 id → 该列内的卡片 id；决定卡片属于哪个分区，也是列内排布前的初始顺序。 */
	order: BoardState["order"];
	/** 卡片之间带类型的关系，读作「来源 类型 目标」；任一端不在图里的关系不画。 */
	relations: readonly Relation[];
	/**
	 * 渲染卡片内容。卡片是固定尺寸（`cardSize`），内容超出的部分被裁掉，请自己限制行数。
	 * 关系图只读，没有拖拽，所以不会为浮起的卡片再渲染一次。
	 */
	renderCard: (card: TCard, context: { column: TColumn }) => ReactNode;
	/** 只显示以这张卡片为根的相关子图；根不在图里时什么也不显示。不给则显示全部。 */
	rootId?: string;
	/** 取子图的方式（方向、步数、类型），仅在给了 `rootId` 时有效。 */
	subgraph?: SubgraphOptions;
	/**
	 * 卡片的统一尺寸（px）。
	 * @default { width: 220, height: 72 }
	 */
	cardSize?: { width: number; height: number };
	/**
	 * 卡片的文字名称，用于关系的文字描述。
	 * @default (card) => card.id
	 */
	getCardLabel?: (card: TCard) => string;
	/** 关系类型的读法与线型，与内置的 `extends`、`fixes`、`blocks` 合并。 */
	relationTypes?: Readonly<Record<string, RelationTypeStyle>>;
	/**
	 * 选中的卡片：它和直接相连的卡片保持清晰，其余卡片与关系线淡化。受控，给出后点击只通过
	 * `onSelectedCardChange` 通知。
	 */
	selectedCardId?: string | null;
	/** 选中变化：点击卡片（再点一次取消，点空白处取消）或聚焦后按 Enter、空格。提供它即启用选中。 */
	onSelectedCardChange?: (cardId: string | null) => void;
	/** 内置文案的语言。 */
	locale?: BoardLocale;
	/** 覆盖内置文案，只需给出要改的键。 */
	messages?: Partial<BoardMessages>;
}

/**
 * 只读的关系图：卡片按列分区自动排布，用与看板相同的关系线连接。
 *
 * 排布完全由输入算出（见 `layoutGraph`），不保存坐标；内容有确定的像素尺寸，放进 `Canvas` 即可平移缩放全屏。
 * 每张有关系的卡片带给读屏的文字描述，选中卡片时高亮相关的卡片与线。
 *
 * @typeParam TCard - 卡片类型，只要求有 id
 * @typeParam TColumn - 列类型，只要求有 id 与可选 title
 */
export function RelationGraph<TCard extends BoardCard, TColumn extends BoardColumn = BoardColumn>({
	columns,
	cards,
	order,
	relations,
	renderCard,
	rootId,
	subgraph,
	cardSize,
	getCardLabel,
	relationTypes: relationTypeOverrides,
	selectedCardId = null,
	onSelectedCardChange,
	locale,
	messages: messageOverrides,
	className,
	style,
	...rest
}: RelationGraphProps<TCard, TColumn>) {
	const messages = resolveMessages(locale, messageOverrides);
	const hintId = useId();
	const width = cardSize?.width ?? DEFAULT_GRAPH_LAYOUT.cardWidth;
	const height = cardSize?.height ?? DEFAULT_GRAPH_LAYOUT.cardHeight;

	const model = useMemo(() => {
		const resolved = resolveBoard(
			{ columns: columns.map((column) => column.id), order },
			cards,
		);
		const placed = new Set(resolved.flatMap((column) => column.cards.map((card) => card.id)));
		const usable = relations.filter(
			(relation) => placed.has(relation.sourceId) && placed.has(relation.targetId),
		);
		const sub = rootId === undefined ? null : relatedSubgraph(usable, rootId, subgraph);
		const visible = sub ? new Set(sub.ids) : null;
		const shown = sub ? sub.relations : usable;
		const byId = new Map<string, TCard>();
		const placement = resolved.flatMap((column) =>
			column.cards.flatMap((card) => {
				if (visible && !visible.has(card.id)) return [];
				byId.set(card.id, card);
				return [{ id: card.id, columnId: column.id, width, height }];
			}),
		);
		const layout = layoutGraph(
			{ columns: resolved.map((column) => column.id), cards: placement, relations: shown },
			{ cardWidth: width, cardHeight: height },
		);
		return { layout, shown, byId, adjacency: createAdjacency(shown) };
	}, [columns, cards, order, relations, rootId, subgraph, width, height]);

	const { layout, shown, byId, adjacency } = model;
	const definitions = new Map<string, TColumn>();
	for (const column of columns)
		if (!definitions.has(column.id)) definitions.set(column.id, column);
	const relationTypes = resolveRelationTypes(locale, relationTypeOverrides);
	const cardLabel = (id: string) => {
		const card = byId.get(id);
		return card ? (getCardLabel?.(card) ?? card.id) : id;
	};
	const rects = new Map(layout.cards.map((entry) => [entry.id, entry.rect]));
	const selectedId = selectedCardId !== null && byId.has(selectedCardId) ? selectedCardId : null;
	const neighborIds = selectedId === null ? null : new Set(adjacency.neighbors(selectedId));
	const selectable = onSelectedCardChange !== undefined;
	const select = (id: string) => onSelectedCardChange?.(selectedId === id ? null : id);

	const cardsByColumn = new Map<string, typeof layout.cards>();
	for (const entry of layout.cards) {
		const list = cardsByColumn.get(entry.columnId);
		if (list) list.push(entry);
		else cardsByColumn.set(entry.columnId, [entry]);
	}
	const rootClass = className
		? `v-kanban v-kanban-graph ${className}`
		: "v-kanban v-kanban-graph";

	if (layout.cards.length === 0)
		return (
			<div
				role="group"
				aria-label={messages.graphLabel}
				className={rootClass}
				data-layout="graph"
				{...rest}
			>
				<p className="v-kanban__empty">{messages.graphEmpty}</p>
			</div>
		);

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: 点击空白处取消选中只是鼠标的便利，卡片上再次按 Enter 或空格同样取消
		<div
			role="group"
			aria-label={messages.graphLabel}
			className={rootClass}
			data-layout="graph"
			// 内容有确定的像素尺寸：画布按它适应窗口，线叠加层以它的左上角为原点
			style={{ ...style, width: layout.width, height: layout.height }}
			onClick={(event) => {
				if (selectedId === null || !selectable) return;
				const target = event.target as Element;
				if (target === event.currentTarget || target.matches(EMPTY_SPACE))
					onSelectedCardChange?.(null);
			}}
			{...rest}
		>
			{layout.columns.map(({ id, rect }) => {
				const title = definitions.get(id)?.title ?? id;
				const entries = cardsByColumn.get(id) ?? [];
				const box = {
					left: rect.left,
					top: rect.top,
					width: rect.right - rect.left,
					height: rect.bottom - rect.top,
				};
				return (
					<div
						key={id}
						className="v-kanban-graph__zone"
						data-zone-id={id}
						aria-hidden="true"
						style={box}
					>
						<div
							className="v-kanban-graph__zone-header"
							style={{ height: DEFAULT_GRAPH_LAYOUT.headerHeight }}
						>
							<span className="v-kanban__column-title">{title}</span>
							<CountBadge count={entries.length} matched={null} messages={messages} />
						</div>
					</div>
				);
			})}
			{layout.columns.map(({ id, rect }) => {
				const column = definitions.get(id) as TColumn;
				return (
					<div
						key={id}
						role="group"
						aria-label={column.title ?? column.id}
						className="v-kanban-graph__column"
						data-column-id={id}
						style={{
							left: rect.left,
							top: rect.top,
							width: rect.right - rect.left,
							height: rect.bottom - rect.top,
						}}
					>
						{/* biome-ignore lint/a11y/noRedundantRoles: 显式 role：list-style: none 会让 Safari 丢弃列表语义 */}
						<ul role="list" className="v-kanban-graph__cards">
							{(cardsByColumn.get(id) ?? []).map((entry) => {
								const card = byId.get(entry.id) as TCard;
								const text = relationsSummary(
									relationEntries(adjacency, entry.id, relationTypes, cardLabel),
									messages,
								);
								const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
									if (
										(event.key !== "Enter" && event.key !== " ") ||
										event.target !== event.currentTarget ||
										event.ctrlKey ||
										event.metaKey ||
										event.altKey
									)
										return;
									event.preventDefault();
									select(entry.id);
								};
								return (
									<li
										key={entry.id}
										className="v-kanban__card v-kanban-graph__card"
										data-card-id={entry.id}
										data-selectable={selectable ? "true" : undefined}
										data-selected={selectedId === entry.id ? "true" : undefined}
										data-related={
											neighborIds?.has(entry.id) ? "true" : undefined
										}
										data-faded={
											selectedId !== null &&
											selectedId !== entry.id &&
											!neighborIds?.has(entry.id)
												? "true"
												: undefined
										}
										data-root={rootId === entry.id ? "true" : undefined}
										aria-current={selectedId === entry.id ? "true" : undefined}
										tabIndex={selectable ? 0 : undefined}
										aria-describedby={selectable ? hintId : undefined}
										onKeyDown={selectable ? onKeyDown : undefined}
										onClick={
											selectable
												? (event) => {
														// 卡片里的按钮、链接、输入框有自己的点击含义，不算选中
														const own = (
															event.target as Element
														).closest(OWN_CLICK);
														if (own && own !== event.currentTarget)
															return;
														select(entry.id);
													}
												: undefined
										}
										style={{
											left: entry.rect.left - rect.left,
											top: entry.rect.top - rect.top,
											width: entry.rect.right - entry.rect.left,
											height: entry.rect.bottom - entry.rect.top,
										}}
									>
										<div className="v-kanban-graph__card-body">
											{renderCard(card, { column })}
										</div>
										{text ? (
											<span className="v-kanban__sr-only">{text}</span>
										) : null}
									</li>
								);
							})}
						</ul>
					</div>
				);
			})}
			<RelationLayer
				relations={shown}
				rects={rects}
				types={relationTypes}
				selectedId={selectedId}
				cardLabel={cardLabel}
			/>
			{selectable ? (
				<span id={hintId} className="v-kanban__sr-only">
					{messages.selectHint}
				</span>
			) : null}
		</div>
	);
}
