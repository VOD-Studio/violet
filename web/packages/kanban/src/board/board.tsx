import type { HTMLAttributes, ReactNode } from "react";
import { type BoardCard, type BoardState, resolveBoard } from "../core/index.ts";
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
	/** 渲染卡片内容。 */
	renderCard: (card: TCard, context: { column: TColumn; index: number }) => ReactNode;
	/** 取代默认列头（标题与卡片数）。`title` 仍作为列分组的可访问名称。 */
	renderColumnHeader?: (column: TColumn, context: { count: number }) => ReactNode;
	/** 取代列内没有卡片时的默认提示；返回 `null` 则不显示任何提示。 */
	renderEmpty?: (column: TColumn) => ReactNode;
	/** 内置文案的语言。 */
	locale?: BoardLocale;
	/** 覆盖内置文案，只需给出要改的键。 */
	messages?: Partial<BoardMessages>;
}

/**
 * 只读看板：按使用方给出的列与顺序排布卡片，不持有数据。
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
	locale,
	messages: messageOverrides,
	className,
	...rest
}: BoardProps<TCard, TColumn>) {
	const messages = resolveMessages(locale, messageOverrides);
	const definitions = new Map<string, TColumn>();
	for (const column of columns)
		if (!definitions.has(column.id)) definitions.set(column.id, column);
	const resolved = resolveBoard({ columns: columns.map((column) => column.id), order }, cards);

	return (
		<div
			role="group"
			aria-label={messages.boardLabel}
			className={className ? `v-kanban ${className}` : "v-kanban"}
			{...rest}
		>
			{resolved.map(({ id, cards: columnCards }) => {
				const column = definitions.get(id) as TColumn;
				const title = column.title ?? column.id;
				return (
					<div key={id} role="group" className="v-kanban__column" aria-label={title}>
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
						{columnCards.length > 0 ? (
							// biome-ignore lint/a11y/noRedundantRoles: 显式 role：list-style: none 会让 Safari 丢弃列表语义
							<ul role="list" className="v-kanban__cards">
								{columnCards.map((card, index) => (
									<li key={card.id} className="v-kanban__card">
										{renderCard(card, { column, index })}
									</li>
								))}
							</ul>
						) : renderEmpty ? (
							renderEmpty(column)
						) : (
							<p className="v-kanban__empty">{messages.emptyColumn}</p>
						)}
					</div>
				);
			})}
		</div>
	);
}
