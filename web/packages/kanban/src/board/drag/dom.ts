import type { AutoSortEntry, ColumnLayout, Point, Rect } from "../../core/index.ts";

/** 看板标记与拖拽逻辑共用的 DOM 约定；`board.tsx` 渲染这些属性，这里读取它们。 */
export const CARD_SELECTOR = "[data-card-id]";
export const COLUMN_SELECTOR = "[data-column-id]";
export const FLIP_SELECTOR = "[data-flip]";

/** 位移过渡的标识；卡片带前缀，避免与 id 恰好叫 placeholder 的卡片冲突。 */
export const PLACEHOLDER_FLIP_ID = "placeholder";
export const cardFlipId = (cardId: string) => `card:${cardId}`;

const toRect = (rect: DOMRect): Rect => ({
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

/** 相对滚动层内容原点的位置，页面滚动与横向滚动都不改变它。 */
export function measureFlip(scroller: HTMLElement) {
	const base = scroller.getBoundingClientRect();
	const positions = new Map<string, Point>();
	for (const element of scroller.querySelectorAll<HTMLElement>(FLIP_SELECTOR)) {
		const rect = element.getBoundingClientRect();
		positions.set(element.getAttribute("data-flip") ?? "", {
			x: rect.left - base.left + scroller.scrollLeft,
			y: rect.top - base.top + scroller.scrollTop,
		});
	}
	return positions;
}
