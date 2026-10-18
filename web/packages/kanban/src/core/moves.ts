import { type BoardState, normalizeBoardState } from "./state.ts";

/** client 坐标系中的点。 */
export interface Point {
	x: number;
	y: number;
}

/** client 坐标系中的矩形。 */
export interface Rect {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

/** 卡片在看板里的位置。 */
export interface BoardPosition {
	columnId: string;
	index: number;
}

/**
 * 一次移动：某张卡片从某列某位置到另一列另一位置。
 *
 * 由使用方决定接受或拒绝；相邻卡片 id 供使用方用分数索引等方式只更新一行。
 */
export interface BoardMove {
	cardId: string;
	from: BoardPosition;
	/** `to.index` 是去掉被拖卡片后的列内序号。 */
	to: BoardPosition;
	/** 目标位置上方的卡片，位于列首时为 null。 */
	previousId: string | null;
	/** 目标位置下方的卡片，位于列尾时为 null。 */
	nextId: string | null;
}

/** 自动排序列让别的列的卡片进入时先落在哪一端。 */
export type AutoSortEntry = "start" | "end";

/** 自动排序列的入口序号：`length` 是该列已有的卡片数。 */
export const entryIndex = (entry: AutoSortEntry, length: number) =>
	entry === "start" ? 0 : length;

/** 一列在屏幕上的几何信息，供落点解析使用。 */
export interface ColumnLayout {
	id: string;
	rect: Rect;
	/** 列内卡片，按显示顺序，不含被拖卡片。 */
	cards: ReadonlyArray<{ id: string; rect: Rect }>;
	/**
	 * 自动排序列：别的列的卡片进入时落在入口一端，与指针高度无关。
	 * @default undefined 普通列，按指针位置决定序号
	 */
	autoSort?: AutoSortEntry;
}

/** 查找卡片所在的列与列内序号。 */
export function locateCard(state: BoardState, cardId: string): BoardPosition | null {
	for (const columnId of state.columns) {
		const index = (state.order[columnId] ?? []).indexOf(cardId);
		if (index !== -1) return { columnId, index };
	}
	return null;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * 生成把卡片移到目标位置的移动。
 *
 * @param state - 当前看板状态
 * @param cardId - 被移动的卡片
 * @param target - 目标列与去掉被拖卡片后的列内序号，越界时收敛到列首或列尾
 * @returns 卡片或目标列不存在时为 null
 */
export function createMove(
	state: BoardState,
	cardId: string,
	target: BoardPosition,
): BoardMove | null {
	const normalized = normalizeBoardState(state);
	const from = locateCard(normalized, cardId);
	const targetOrder = normalized.order[target.columnId];
	if (!from || !targetOrder) return null;
	const remaining = targetOrder.filter((id) => id !== cardId);
	const index = clamp(target.index, 0, remaining.length);
	return {
		cardId,
		from,
		to: { columnId: target.columnId, index },
		previousId: remaining[index - 1] ?? null,
		nextId: remaining[index] ?? null,
	};
}

/** 放回原来的位置不算移动。 */
export function isNoopMove(move: BoardMove): boolean {
	return move.from.columnId === move.to.columnId && move.from.index === move.to.index;
}

/**
 * 把移动应用到看板状态。
 *
 * @returns 新状态，传入的状态不会被修改
 */
export function applyMove(state: BoardState, move: BoardMove): BoardState {
	const normalized = normalizeBoardState(state);
	const order: Record<string, readonly string[]> = {};
	for (const columnId of normalized.columns)
		order[columnId] = normalized.order[columnId].filter((id) => id !== move.cardId);
	const target = order[move.to.columnId];
	if (target) {
		const index = clamp(move.to.index, 0, target.length);
		order[move.to.columnId] = [...target.slice(0, index), move.cardId, ...target.slice(index)];
	}
	return { columns: normalized.columns, order };
}

/**
 * 由指针位置解析落点。
 *
 * 横向归属最近的列（列间空隙按中线划分），纵向按卡片中线数出序号；指针离开所有列时没有落点。
 *
 * @param columns - 从左到右的列几何，卡片不含被拖卡片
 * @param point - 指针的 client 坐标
 * @param options.originColumnId - 被拖卡片出发的列；自动排序列只对从别处进入的卡片使用入口
 * @param options.slack - 指针越过看板边缘多少 px 仍算在看板内，超出才没有落点，默认 48（约一张卡片的高度）
 * @returns 没有落点（指针远离看板）时为 null
 */
export function resolveDropTarget(
	columns: readonly ColumnLayout[],
	point: Point,
	options: { originColumnId?: string; slack?: number } = {},
): BoardPosition | null {
	const slack = options.slack ?? 48;
	const hit = columns.find((column, i) => {
		const previous = columns[i - 1];
		const next = columns[i + 1];
		const left = previous
			? (previous.rect.right + column.rect.left) / 2
			: column.rect.left - slack;
		const right = next ? (column.rect.right + next.rect.left) / 2 : column.rect.right + slack;
		return point.x >= left && point.x <= right;
	});
	if (!hit || point.y < hit.rect.top - slack || point.y > hit.rect.bottom + slack) return null;
	if (hit.autoSort && hit.id !== options.originColumnId)
		return { columnId: hit.id, index: entryIndex(hit.autoSort, hit.cards.length) };
	const index = hit.cards.filter(
		(card) => (card.rect.top + card.rect.bottom) / 2 < point.y,
	).length;
	return { columnId: hit.id, index };
}

/**
 * 移动是否违反自动排序规则：在自动排序列内手动重排。
 *
 * @param isAutoSort - 判断某列是否为自动排序列
 * @returns 违反（应拒绝）时为 true
 */
export function violatesAutoSort(
	move: BoardMove,
	isAutoSort: (columnId: string) => boolean,
): boolean {
	return (
		move.from.columnId === move.to.columnId && isAutoSort(move.to.columnId) && !isNoopMove(move)
	);
}
