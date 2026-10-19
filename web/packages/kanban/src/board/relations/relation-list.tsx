import { type BoardCard, createAdjacency, type Relation } from "../../core/index.ts";
import type { Locale } from "../../locale.ts";
import { resolveMessages } from "../messages.ts";
import { type RelationTypeStyle, relationStyle, resolveRelationTypes } from "./types.ts";

/** `RelationList` 的属性。 */
export interface RelationListProps<TCard extends BoardCard = BoardCard> {
	relations: readonly Relation[];
	/** 卡片，用来取名称；不在其中的卡片按 id 显示。 */
	cards: readonly TCard[];
	/** 卡片名称，默认用 id。 */
	getCardLabel?: (card: TCard) => string;
	/** 只列与这张卡片有关的关系（出入两个方向）；不给则列出全部。 */
	cardId?: string;
	/** 类型的读法映射，与内置的 extends、fixes、blocks 合并。 */
	relationTypes?: Readonly<Record<string, RelationTypeStyle>>;
	locale?: Locale;
	/** 没有关系时的提示。 */
	emptyText?: string;
	className?: string;
}

/**
 * 关系的文本等价：每条读作「来源 类型 目标」的列表项，供读屏或不画线的窄屏布局使用。
 */
export function RelationList<TCard extends BoardCard = BoardCard>({
	relations,
	cards,
	getCardLabel,
	cardId,
	relationTypes,
	locale,
	emptyText,
	className,
}: RelationListProps<TCard>) {
	const types = resolveRelationTypes(locale, relationTypes);
	const byId = new Map(cards.map((card) => [card.id, card]));
	const label = (id: string) => {
		const card = byId.get(id);
		return card ? (getCardLabel?.(card) ?? card.id) : id;
	};
	const shown = cardId ? createAdjacency(relations).of(cardId) : relations;
	if (shown.length === 0)
		return (
			<p
				className={
					className ? `v-kanban__relation-empty ${className}` : "v-kanban__relation-empty"
				}
			>
				{emptyText ?? resolveMessages(locale).relationListEmpty}
			</p>
		);
	return (
		<ul
			className={
				className ? `v-kanban__relation-list ${className}` : "v-kanban__relation-list"
			}
		>
			{shown.map((relation, index) => (
				<li key={index}>
					{`${label(relation.sourceId)} ${relationStyle(types, relation.type).label} ${label(relation.targetId)}`}
				</li>
			))}
		</ul>
	);
}
