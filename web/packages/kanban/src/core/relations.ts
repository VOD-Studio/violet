import type { Point, Rect } from "./moves.ts";

/**
 * 带类型的有向关系，读作「来源 类型 目标」，例如「A 扩展 B」。
 * 类型由使用方定义，包只按类型分别做环检测。
 */
export interface Relation<TType extends string = string> {
	sourceId: string;
	targetId: string;
	type: TType;
}

/** `checkRelation` 的结果。 */
export type RelationCheck =
	| { ok: true }
	| { ok: false; reason: "self" | "duplicate" }
	/** `path` 是同一类型下从目标走回来源的卡片 id，加上这条新关系正好闭合成环。 */
	| { ok: false; reason: "cycle"; path: string[] };

/**
 * 判断能否新增一条关系：不能指向自身，不能与已有的同来源同目标同类型重复，同一类型内不能成环。
 *
 * 环检测按类型分别进行：不同类型的方向语义不同（「A 扩展 B」读作 A 在 B 之后，「A 阻塞 B」读作 A 在 B 之前），
 * 把它们合在一起检测会误判。数据里已有的环不会让检测死循环。
 */
export function checkRelation(existing: readonly Relation[], candidate: Relation): RelationCheck {
	if (candidate.sourceId === candidate.targetId) return { ok: false, reason: "self" };
	const sameType = existing.filter((relation) => relation.type === candidate.type);
	if (
		sameType.some(
			(relation) =>
				relation.sourceId === candidate.sourceId &&
				relation.targetId === candidate.targetId,
		)
	)
		return { ok: false, reason: "duplicate" };

	// 从目标出发沿同类型的边找来源：找得到，新边就把它闭合成环。广度优先，路径最短且确定
	const next = new Map<string, string[]>();
	for (const relation of sameType) {
		const list = next.get(relation.sourceId);
		if (list) list.push(relation.targetId);
		else next.set(relation.sourceId, [relation.targetId]);
	}
	const parent = new Map<string, string | null>([[candidate.targetId, null]]);
	const queue = [candidate.targetId];
	for (let head = 0; head < queue.length; head += 1) {
		const id = queue[head];
		if (id === candidate.sourceId) {
			const path: string[] = [];
			for (let at: string | null | undefined = id; at != null; at = parent.get(at))
				path.unshift(at);
			return { ok: false, reason: "cycle", path };
		}
		for (const target of next.get(id) ?? []) {
			if (parent.has(target)) continue;
			parent.set(target, id);
			queue.push(target);
		}
	}
	return { ok: true };
}

/** 关系的邻接查询，所有结果保持输入顺序。 */
export interface Adjacency<R extends Relation = Relation> {
	/** 以 `id` 为来源的关系，可按类型过滤。 */
	outgoing(id: string, type?: string): readonly R[];
	/** 以 `id` 为目标的关系，可按类型过滤。 */
	incoming(id: string, type?: string): readonly R[];
	/** 与 `id` 相连的所有关系，不分方向。 */
	of(id: string): readonly R[];
	/** 直接相连的卡片 id，去重、不含自己。 */
	neighbors(id: string): readonly string[];
}

/** 建立邻接查询。 */
export function createAdjacency<R extends Relation>(relations: readonly R[]): Adjacency<R> {
	const out = new Map<string, R[]>();
	const incoming = new Map<string, R[]>();
	const all = new Map<string, R[]>();
	const push = (map: Map<string, R[]>, id: string, relation: R) => {
		const list = map.get(id);
		if (list) list.push(relation);
		else map.set(id, [relation]);
	};
	for (const relation of relations) {
		push(out, relation.sourceId, relation);
		push(incoming, relation.targetId, relation);
		push(all, relation.sourceId, relation);
		if (relation.targetId !== relation.sourceId) push(all, relation.targetId, relation);
	}
	const byType = (list: readonly R[] | undefined, type?: string): readonly R[] =>
		type === undefined
			? (list ?? [])
			: (list ?? []).filter((relation) => relation.type === type);
	return {
		outgoing: (id, type) => byType(out.get(id), type),
		incoming: (id, type) => byType(incoming.get(id), type),
		of: (id) => all.get(id) ?? [],
		neighbors: (id) => {
			const seen = new Set<string>();
			for (const relation of all.get(id) ?? []) {
				const other = relation.sourceId === id ? relation.targetId : relation.sourceId;
				if (other !== id) seen.add(other);
			}
			return [...seen];
		},
	};
}

/** 一条关系线的几何：SVG 路径、两端与终点处的方向。 */
export interface EdgeRoute {
	/** SVG 三次贝塞尔路径。 */
	d: string;
	start: Point;
	end: Point;
	/** 终点处线的切线方向（弧度，指向终点），线端标记据此旋转。 */
	angle: number;
}

/** 水平方向上控制点离端点的距离范围。 */
const MIN_REACH = 24;
const MAX_REACH = 120;
/**
 * 同一列里的两张卡片之间，线从右缘向外鼓出的控制距离。曲线最远伸出它的 3/4，要不超过滚动层的内边距（6px），
 * 最后一列里的弧线才不会被滚动层裁掉。
 */
const BULGE = 8;

const round = (value: number) => Math.round(value * 100) / 100;
const middle = (rect: Rect) => (rect.top + rect.bottom) / 2;

/**
 * 两张卡片之间的关系线：目标在右边或左边时从相对的两个侧边水平进出，
 * 在同一列（水平方向有重叠）时从右缘绕出再回到目标右缘，不穿过中间的卡片。
 * 坐标系由调用方决定，输出与输入同一坐标系。
 */
export function routeEdge(from: Rect, to: Rect): EdgeRoute {
	let start: Point;
	let end: Point;
	let first: Point;
	let second: Point;
	if (to.left >= from.right) {
		start = { x: from.right, y: middle(from) };
		end = { x: to.left, y: middle(to) };
		const reach = Math.min(MAX_REACH, Math.max(MIN_REACH, (end.x - start.x) / 2));
		first = { x: start.x + reach, y: start.y };
		second = { x: end.x - reach, y: end.y };
	} else if (to.right <= from.left) {
		start = { x: from.left, y: middle(from) };
		end = { x: to.right, y: middle(to) };
		const reach = Math.min(MAX_REACH, Math.max(MIN_REACH, (start.x - end.x) / 2));
		first = { x: start.x - reach, y: start.y };
		second = { x: end.x + reach, y: end.y };
	} else {
		start = { x: from.right, y: middle(from) };
		end = { x: to.right, y: middle(to) };
		const out = Math.max(start.x, end.x) + BULGE;
		first = { x: out, y: start.y };
		second = { x: out, y: end.y };
	}
	const point = (p: Point) => `${round(p.x)} ${round(p.y)}`;
	return {
		d: `M ${point(start)} C ${point(first)} ${point(second)} ${point(end)}`,
		start,
		end,
		angle: Math.atan2(end.y - second.y, end.x - second.x),
	};
}

/** 终点处的箭头：尖在 `end`，沿方向 `angle` 向后展开 `size`。 */
export function arrowHead(end: Point, angle: number, size: number): string {
	const back = { x: end.x - size * Math.cos(angle), y: end.y - size * Math.sin(angle) };
	const half = { x: (-Math.sin(angle) * size) / 2, y: (Math.cos(angle) * size) / 2 };
	const point = (p: Point) => `${round(p.x)} ${round(p.y)}`;
	return `M ${point(end)} L ${point({ x: back.x - half.x, y: back.y - half.y })} L ${point({ x: back.x + half.x, y: back.y + half.y })} Z`;
}

/** 终点处的挡条：垂直于方向 `angle`、以 `end` 为中心、长 `length` 的线段。 */
export function blockerBar(end: Point, angle: number, length: number): string {
	const half = { x: (-Math.sin(angle) * length) / 2, y: (Math.cos(angle) * length) / 2 };
	const point = (p: Point) => `${round(p.x)} ${round(p.y)}`;
	return `M ${point({ x: end.x - half.x, y: end.y - half.y })} L ${point({ x: end.x + half.x, y: end.y + half.y })}`;
}
