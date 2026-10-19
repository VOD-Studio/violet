/** 看板状态：列的顺序，以及每列内卡片 id 的顺序。包不持有卡片内容。 */
export interface BoardState {
	/** 列 id，数组顺序即从左到右的列顺序。 */
	columns: readonly string[];
	/** 列 id → 该列内从上到下的卡片 id。 */
	order: Readonly<Record<string, readonly string[]>>;
}

/**
 * 规整看板状态：每列都有一个排序数组，丢弃不属于任何列的记录。
 *
 * 重复的列 id 与卡片 id 只保留第一次出现；一张卡片出现在多列时归属列顺序中最靠前的列。
 *
 * @param state - 使用方给出的状态，不会被修改
 * @returns 新状态
 */
export function normalizeBoardState(state: BoardState): BoardState {
	const columns = [...new Set(state.columns)];
	const placed = new Set<string>();
	const order: Record<string, readonly string[]> = {};
	for (const column of columns) {
		const cards: string[] = [];
		for (const id of state.order[column] ?? []) {
			if (placed.has(id)) continue;
			placed.add(id);
			cards.push(id);
		}
		order[column] = cards;
	}
	return { columns, order };
}

/** 只要求有 id 的卡片。包不关心其余字段。 */
export interface BoardCard {
	id: string;
}

/** 一列及其按序排好的卡片。 */
export interface ResolvedColumn<TCard extends BoardCard> {
	id: string;
	cards: TCard[];
}

/**
 * 按看板状态把卡片池排成各列的有序卡片。
 *
 * 状态先经 {@link normalizeBoardState} 规整；排序里引用了卡片池不存在的 id 时跳过，卡片池里未被排序引用的卡片不出现。
 *
 * @typeParam TCard - 使用方的卡片类型
 * @param state - 列与列内顺序
 * @param cards - 卡片池，顺序无关
 * @returns 按列顺序排列的列
 */
export function resolveBoard<TCard extends BoardCard>(
	state: BoardState,
	cards: Iterable<TCard>,
): ResolvedColumn<TCard>[] {
	const pool = new Map<string, TCard>();
	for (const card of cards) pool.set(card.id, card);
	const normalized = normalizeBoardState(state);
	return normalized.columns.map((id) => ({
		id,
		cards: normalized.order[id].flatMap((cardId) => {
			const card = pool.get(cardId);
			return card ? [card] : [];
		}),
	}));
}
