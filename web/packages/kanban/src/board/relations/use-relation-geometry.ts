import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Rect } from "../../core/index.ts";
import { CARD_SELECTOR, screenScale } from "../drag/dom.ts";
import { useLatest } from "../drag/use-latest.ts";

const EMPTY: ReadonlyMap<string, Rect> = new Map();
/** 位置差小于它视为没变，免得亚像素抖动引起无谓的重绘。 */
const EPSILON = 0.05;

function same(a: ReadonlyMap<string, Rect>, b: ReadonlyMap<string, Rect>) {
	if (a.size !== b.size) return false;
	for (const [id, rect] of a) {
		const other = b.get(id);
		if (
			!other ||
			Math.abs(rect.left - other.left) > EPSILON ||
			Math.abs(rect.top - other.top) > EPSILON ||
			Math.abs(rect.right - other.right) > EPSILON ||
			Math.abs(rect.bottom - other.bottom) > EPSILON
		)
			return false;
	}
	return true;
}

/** 看板里所有卡片节点，按 id 索引：一次遍历，免得每个 id 各扫一遍。 */
function indexCards(scroller: HTMLElement) {
	const index = new Map<string, HTMLElement>();
	for (const element of scroller.querySelectorAll<HTMLElement>(CARD_SELECTOR)) {
		const id = element.getAttribute("data-card-id");
		if (id !== null && !index.has(id)) index.set(id, element);
	}
	return index;
}

/**
 * 量出各卡片在滚动层内容坐标系里的矩形（布局像素，随横向滚动，不随画布的缩放平移变化）。
 *
 * 看不见的卡片不计入：折叠的列里的、没有布局的。被拿起的卡片（拖拽、落位期间）用浮起卡片的位置。
 */
function measureCards(
	scroller: HTMLElement,
	ids: Iterable<string>,
	ghost: HTMLElement | null,
	heldId: string | null,
): Map<string, Rect> {
	const scale = screenScale(scroller);
	const base = scroller.getBoundingClientRect();
	const originX = base.left + scroller.clientLeft * scale;
	const originY = base.top + scroller.clientTop * scale;
	const index = indexCards(scroller);
	const rects = new Map<string, Rect>();
	for (const id of ids) {
		const element = id === heldId && ghost ? ghost : index.get(id);
		if (!element || element.closest('[data-collapsed="true"]')) continue;
		const box = element.getBoundingClientRect();
		if (box.width === 0 && box.height === 0) continue;
		rects.set(id, {
			left: (box.left - originX) / scale + scroller.scrollLeft,
			top: (box.top - originY) / scale + scroller.scrollTop,
			right: (box.right - originX) / scale + scroller.scrollLeft,
			bottom: (box.bottom - originY) / scale + scroller.scrollTop,
		});
	}
	return rects;
}

/** 有会结束的动画在跑（位置过渡、落位）；无限循环的动画（转圈、脉动）不算，否则测量永远停不下来。 */
function hasFiniteAnimation(scroller: HTMLElement) {
	return (
		scroller
			.getAnimations?.({ subtree: true })
			.some((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime)) ??
		false
	);
}

/** `useRelationGeometry` 的输入。 */
export interface RelationGeometryOptions {
	scrollerRef: RefObject<HTMLElement | null>;
	/** 需要量位置的卡片 id；为空时不测量。 */
	ids: readonly string[];
	ghostRef: RefObject<HTMLElement | null>;
	/** 被拿起的卡片（有浮起卡片的那张）。 */
	heldId: string | null;
	/** 拖拽或键盘拿起期间：每帧重新测量。 */
	active: boolean;
	/** 布局可能变化的指纹；变化后在位置过渡结束前每帧重新测量。 */
	version: string;
}

/**
 * 关系线的端点：每次渲染后量一次；拖拽期间与位置过渡（让位、落位）期间每帧量；
 * 看板或相关卡片自己改变尺寸时也量。只在位置真的变了才触发重绘。
 */
export function useRelationGeometry(options: RelationGeometryOptions): ReadonlyMap<string, Rect> {
	const { scrollerRef, ids, ghostRef, heldId, active, version } = options;
	const enabled = ids.length > 0;
	const idsKey = ids.join("\u0000");
	const [rects, setRects] = useState(EMPTY);
	const current = useRef(EMPTY);
	const live = useLatest({ ids, heldId });

	const measure = useCallback(() => {
		const scroller = scrollerRef.current;
		if (!scroller) return;
		const { ids: wanted, heldId: held } = live.current;
		const next = wanted.length ? measureCards(scroller, wanted, ghostRef.current, held) : EMPTY;
		if (same(current.current, next)) return;
		current.current = next;
		setRects(next);
	}, [scrollerRef, ghostRef, live]);

	// 每次渲染之后：位置可能因为顺序、折叠、筛选提示等变了
	useLayoutEffect(() => {
		measure();
	});

	// 拖拽与位置过渡期间：每帧跟着量，安静几帧后停
	// biome-ignore lint/correctness/useExhaustiveDependencies: version 只是重启循环的触发器
	useEffect(() => {
		if (!enabled) return;
		let frame = 0;
		let quiet = 0;
		const tick = () => {
			measure();
			const animating = scrollerRef.current ? hasFiniteAnimation(scrollerRef.current) : false;
			quiet = active || animating ? 0 : quiet + 1;
			if (quiet < 3) frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, [enabled, active, version, scrollerRef, measure]);

	// 看板自己或相关的卡片改变尺寸（字体加载、图片、自动增高的输入框、窗口缩放）：位置没有重新渲染也要量
	// biome-ignore lint/correctness/useExhaustiveDependencies: version 变化时卡片节点可能换了，重新观察
	useEffect(() => {
		const scroller = scrollerRef.current;
		if (!enabled || !scroller || typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(() => measure());
		observer.observe(scroller);
		const index = indexCards(scroller);
		for (const id of live.current.ids) {
			const element = index.get(id);
			if (element) observer.observe(element);
		}
		return () => observer.disconnect();
	}, [enabled, idsKey, version, scrollerRef, measure, live]);

	return enabled ? rects : EMPTY;
}
