import type { AutoSortEntry, ColumnLayout, Point, Rect } from "../../core/index.ts";

/** 看板标记与拖拽逻辑共用的 DOM 约定；`board.tsx` 渲染这些属性，这里读取它们。 */
export const CARD_SELECTOR = "[data-card-id]";
export const COLUMN_SELECTOR = "[data-column-id]";
export const FLIP_SELECTOR = "[data-flip]";

/** 位移过渡的标识；卡片带前缀，避免与 id 恰好叫 placeholder 的卡片冲突。 */
export const PLACEHOLDER_FLIP_ID = "placeholder";
export const cardFlipId = (cardId: string) => `card:${cardId}`;

export const toRect = (rect: DOMRect): Rect => ({
	left: rect.left,
	top: rect.top,
	right: rect.right,
	bottom: rect.bottom,
});

export const findCard = (root: HTMLElement, cardId: string) =>
	[...root.querySelectorAll<HTMLElement>(CARD_SELECTOR)].find(
		(element) => element.getAttribute("data-card-id") === cardId,
	);

/** 测量各列与列内卡片的屏幕几何，被拖卡片不计入。 */
export function measureColumns(
	root: HTMLElement,
	autoSort: (columnId: string) => AutoSortEntry | undefined,
	draggedId: string,
): ColumnLayout[] {
	return [...root.querySelectorAll<HTMLElement>(COLUMN_SELECTOR)].map((column) => {
		const id = column.getAttribute("data-column-id") ?? "";
		return {
			id,
			rect: toRect(column.getBoundingClientRect()),
			autoSort: autoSort(id),
			cards: [...column.querySelectorAll<HTMLElement>(CARD_SELECTOR)]
				.filter((card) => card.getAttribute("data-card-id") !== draggedId)
				.map((card) => ({
					id: card.getAttribute("data-card-id") ?? "",
					rect: toRect(card.getBoundingClientRect()),
				})),
		};
	});
}

/**
 * 屏幕像素与布局像素之比：看板放在被缩放的祖先（画布）里时不为 1。
 *
 * 屏幕宽度来自 `getBoundingClientRect`，布局宽度来自不受 transform 影响的 `offsetWidth`。
 */
export function screenScale(element: HTMLElement): number {
	const layout = element.offsetWidth;
	if (!layout) return 1;
	const scale = element.getBoundingClientRect().width / layout;
	return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

/** 相对滚动层内容原点的位置（布局像素），页面滚动、横向滚动与画布的缩放平移都不改变它。 */
export function measureFlip(scroller: HTMLElement) {
	const base = scroller.getBoundingClientRect();
	const scale = screenScale(scroller);
	const positions = new Map<string, Point>();
	for (const element of scroller.querySelectorAll<HTMLElement>(FLIP_SELECTOR)) {
		const rect = element.getBoundingClientRect();
		positions.set(element.getAttribute("data-flip") ?? "", {
			x: (rect.left - base.left) / scale + scroller.scrollLeft,
			y: (rect.top - base.top) / scale + scroller.scrollTop,
		});
	}
	return positions;
}

/** 卡片节点的数据属性：看板渲染它们，拖拽与键盘逻辑读取它们。 */
export function cardAttributes(state: {
	cardId: string;
	/** 拖拽中留在原处隐藏的那一张。 */
	origin: boolean;
	draggable: boolean;
	lifted: boolean;
	settling: boolean;
}) {
	return {
		"data-card-id": state.cardId,
		"data-flip": state.origin ? undefined : cardFlipId(state.cardId),
		"data-origin": state.origin ? "true" : undefined,
		"data-draggable": state.draggable ? "true" : undefined,
		"data-lifted": state.lifted ? "true" : undefined,
		"data-settling": state.settling ? "true" : undefined,
	};
}
