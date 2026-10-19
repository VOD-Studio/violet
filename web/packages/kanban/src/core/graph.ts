import type { Rect } from "./moves.ts";
import type { Relation } from "./relations.ts";

/** 参与排布的一张卡片：id、所在列，以及可选的尺寸（缺省用 `GraphLayoutOptions` 里的统一尺寸）。 */
export interface GraphCard {
	id: string;
	columnId: string;
	width?: number;
	height?: number;
}

/** `layoutGraph` 的输入。 */
export interface GraphLayoutInput {
	/** 列 id，数组顺序即从左到右。 */
	columns: readonly string[];
	/** 卡片；同一列里的输入顺序是排布前的初始顺序，也是并列时的先后。 */
	cards: readonly GraphCard[];
	relations: readonly Relation[];
}

/** 排布参数，单位 px。 */
export interface GraphLayoutOptions {
	/** 卡片统一的宽度。 */
	cardWidth?: number;
	/** 卡片统一的高度。 */
	cardHeight?: number;
	/** 同一列里相邻卡片的间距。 */
	cardGap?: number;
	/** 相邻两列之间的间距：关系线从这里穿过，留得越宽线越舒展。 */
	columnGap?: number;
	/** 列内左右的留白。 */
	columnPaddingX?: number;
	/** 列内上下的留白，不含列头。 */
	columnPaddingY?: number;
	/** 列头的高度，卡片排在它下面。 */
	headerHeight?: number;
	/** 减少交叉的扫描轮数；0 即保持输入顺序。 */
	sweeps?: number;
}

/** 排布参数的默认值。 */
export const DEFAULT_GRAPH_LAYOUT: Readonly<Required<GraphLayoutOptions>> = {
	cardWidth: 220,
	cardHeight: 72,
	cardGap: 16,
	columnGap: 96,
	columnPaddingX: 16,
	columnPaddingY: 16,
	headerHeight: 48,
	sweeps: 4,
};

/** 排布结果：坐标原点在左上角，所有列等高。 */
export interface GraphLayout {
	columns: Array<{ id: string; rect: Rect }>;
	cards: Array<{ id: string; columnId: string; rect: Rect }>;
	width: number;
	height: number;
}

const nonNegative = (value: number | undefined, fallback: number) =>
	value !== undefined && Number.isFinite(value) && value >= 0 ? value : fallback;
const positive = (value: number | undefined, fallback: number) =>
	value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;

/**
 * 把卡片按列分区排布成关系图：列从左到右，列内从上到下，关系线两端贴着各自的卡片。
 *
 * 不保存也不需要任何坐标：同一份输入（含顺序）总得到同一份结果，没有随机与时间。
 * 列内顺序以输入顺序为起点，再按跨列的邻居位置做几轮重心排序以减少交叉；
 * 同一列内的关系不参与排序，没有跨列关系的卡片留在原来的次序附近。
 * 不属于任何列的卡片与重复的 id 被丢弃，指向这些卡片的关系忽略。
 */
export function layoutGraph(
	input: GraphLayoutInput,
	options: GraphLayoutOptions = {},
): GraphLayout {
	const d = DEFAULT_GRAPH_LAYOUT;
	const cardWidth = positive(options.cardWidth, d.cardWidth);
	const cardHeight = positive(options.cardHeight, d.cardHeight);
	const cardGap = nonNegative(options.cardGap, d.cardGap);
	const columnGap = nonNegative(options.columnGap, d.columnGap);
	const paddingX = nonNegative(options.columnPaddingX, d.columnPaddingX);
	const paddingY = nonNegative(options.columnPaddingY, d.columnPaddingY);
	const headerHeight = nonNegative(options.headerHeight, d.headerHeight);
	const sweeps = Math.floor(nonNegative(options.sweeps, d.sweeps));
	const widthOf = (card: GraphCard) => positive(card.width, cardWidth);
	const heightOf = (card: GraphCard) => positive(card.height, cardHeight);

	const columnIds = [...new Set(input.columns)];
	const columnIndex = new Map(columnIds.map((id, index) => [id, index]));
	const stacks: GraphCard[][] = columnIds.map(() => []);
	const columnOf = new Map<string, number>();
	for (const card of input.cards) {
		const column = columnIndex.get(card.columnId);
		if (column === undefined || columnOf.has(card.id)) continue;
		columnOf.set(card.id, column);
		stacks[column].push(card);
	}

	// 只有跨列的关系影响排序；两端缺一端的忽略
	const across = new Map<string, string[]>();
	const link = (from: string, to: string) => {
		const list = across.get(from);
		if (list) list.push(to);
		else across.set(from, [to]);
	};
	for (const relation of input.relations) {
		const from = columnOf.get(relation.sourceId);
		const to = columnOf.get(relation.targetId);
		if (from === undefined || to === undefined || from === to) continue;
		link(relation.sourceId, relation.targetId);
		link(relation.targetId, relation.sourceId);
	}

	// 排序时的纵向位置：一列从顶向下紧凑堆叠时各卡片的中心
	const centerY = new Map<string, number>();
	const place = (stack: readonly GraphCard[]) => {
		let y = 0;
		for (const card of stack) {
			const height = heightOf(card);
			centerY.set(card.id, y + height / 2);
			y += height + cardGap;
		}
	};
	for (const stack of stacks) place(stack);

	const reorder = (column: number) => {
		const scored = stacks[column].map((card, position) => {
			const near = across.get(card.id);
			const own = centerY.get(card.id) as number;
			const score = near
				? near.reduce((sum, id) => sum + (centerY.get(id) as number), 0) / near.length
				: own;
			return { card, score, position };
		});
		scored.sort((a, b) => a.score - b.score || a.position - b.position);
		stacks[column] = scored.map((entry) => entry.card);
		place(stacks[column]);
	};
	for (let sweep = 0; sweep < sweeps; sweep += 1) {
		const forward = sweep % 2 === 0;
		for (let step = 0; step < columnIds.length; step += 1)
			reorder(forward ? step : columnIds.length - 1 - step);
	}

	const stackHeight = (stack: readonly GraphCard[]) =>
		stack.reduce((sum, card, index) => sum + heightOf(card) + (index > 0 ? cardGap : 0), 0);
	const inner = Math.max(cardHeight, ...stacks.map(stackHeight));
	const height = columnIds.length === 0 ? 0 : headerHeight + paddingY * 2 + inner;
	const layout: GraphLayout = { columns: [], cards: [], width: 0, height };
	let left = 0;
	for (const [index, id] of columnIds.entries()) {
		const width = Math.max(cardWidth, ...stacks[index].map(widthOf)) + paddingX * 2;
		layout.columns.push({ id, rect: { left, top: 0, right: left + width, bottom: height } });
		let top = headerHeight + paddingY;
		for (const card of stacks[index]) {
			layout.cards.push({
				id: card.id,
				columnId: id,
				rect: {
					left: left + paddingX,
					top,
					right: left + paddingX + widthOf(card),
					bottom: top + heightOf(card),
				},
			});
			top += heightOf(card) + cardGap;
		}
		left += width + columnGap;
	}
	layout.width = columnIds.length === 0 ? 0 : left - columnGap;
	return layout;
}

/** `relatedSubgraph` 的选项。 */
export interface SubgraphOptions {
	/**
	 * 沿哪个方向找：`out` 沿「来源 → 目标」走（根指向的卡片），`in` 沿目标回到来源（指向根的卡片，
	 * 例如扩展根的那些子卡片），`both` 不分方向，即根所在的连通部分。
	 * @default "both"
	 */
	direction?: "both" | "out" | "in";
	/**
	 * 离根最多几步，根是 0 步。
	 * @default undefined 不限
	 */
	depth?: number;
	/**
	 * 只考虑这些类型的关系，找路与结果里都是。
	 * @default undefined 全部类型
	 */
	types?: readonly string[];
}

/** `relatedSubgraph` 的结果。 */
export interface Subgraph<R extends Relation = Relation> {
	/** 子图里的卡片 id：根在最前，其余按离根的步数与关系的输入顺序。 */
	ids: string[];
	/** 两端都在子图里的关系，保持输入顺序。 */
	relations: R[];
}

/**
 * 以一张卡片为根取它的相关子图。
 *
 * 广度优先，结果确定；关系成环、重复、指向自己都不会让它停不下来。
 * 根不在任何关系里时，子图只有它自己。
 */
export function relatedSubgraph<R extends Relation>(
	relations: readonly R[],
	rootId: string,
	options: SubgraphOptions = {},
): Subgraph<R> {
	const direction = options.direction ?? "both";
	const limit =
		options.depth !== undefined && Number.isFinite(options.depth)
			? Math.max(0, Math.floor(options.depth))
			: Number.POSITIVE_INFINITY;
	const considered = (
		options.types
			? relations.filter((relation) => options.types?.includes(relation.type))
			: relations
	).filter((relation) => relation.sourceId !== relation.targetId);

	const next = new Map<string, string[]>();
	const link = (from: string, to: string) => {
		const list = next.get(from);
		if (list) list.push(to);
		else next.set(from, [to]);
	};
	for (const relation of considered) {
		if (direction !== "in") link(relation.sourceId, relation.targetId);
		if (direction !== "out") link(relation.targetId, relation.sourceId);
	}

	const steps = new Map<string, number>([[rootId, 0]]);
	const ids = [rootId];
	for (let head = 0; head < ids.length; head += 1) {
		const id = ids[head];
		const step = steps.get(id) as number;
		if (step >= limit) continue;
		for (const target of next.get(id) ?? []) {
			if (steps.has(target)) continue;
			steps.set(target, step + 1);
			ids.push(target);
		}
	}
	return {
		ids,
		relations: considered.filter(
			(relation) => steps.has(relation.sourceId) && steps.has(relation.targetId),
		),
	};
}
