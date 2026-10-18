import type { Locale } from "../locale.ts";

/** 看板内置文案的语言。 */
export type BoardLocale = Locale;

/**
 * 可覆盖的展示文案。
 *
 * 占位符替换为纯文本，不解释为 HTML。
 */
export interface BoardMessages {
	/**
	 * 看板整体的可访问名称。
	 * @example "Kanban board"
	 */
	boardLabel: string;
	/**
	 * 列内卡片数量，读屏朗读。
	 *
	 * {count} 替换为数量。
	 * @example "Cards: {count}"
	 */
	cardCount: string;
	/**
	 * 列内没有卡片时的提示。
	 * @example "No cards"
	 */
	emptyColumn: string;
	/**
	 * 在自动排序列内手动重排时的拒绝原因。
	 * @example "This column is sorted automatically. Cards can't be reordered by hand."
	 */
	autoSorted: string;
	/**
	 * `canMove` 拒绝但没有给出原因时的提示。
	 * @example "This card can't be moved here."
	 */
	moveRejected: string;
	/**
	 * `onMove` 失败、卡片已回到原位时的提示。
	 * @example "The move couldn't be saved. The card is back where it was."
	 */
	moveFailed: string;
	/**
	 * 键盘操作说明，关联到每张可拖动的卡片。
	 * @example "Press Space or Enter to pick up this card. Then use the arrow keys to move it, Space or Enter to drop it, and Escape to cancel."
	 */
	keyboardHint: string;
	/**
	 * 键盘拿起卡片时的播报。
	 *
	 * {card}、{column}、{position}、{count} 分别替换为卡片名称、列名、位置与该列卡片数。
	 * @example "Picked up {card}. {column}, position {position} of {count}. Use the arrow keys to move it, Space or Enter to drop it, Escape to cancel."
	 */
	keyboardPickedUp: string;
	/**
	 * 键盘移动一步后的播报，占位符同 `keyboardPickedUp`。
	 * @example "{column}, position {position} of {count}."
	 */
	keyboardMoved: string;
	/**
	 * 已到边缘、无法继续移动时的播报，占位符同 `keyboardPickedUp`。
	 * @example "Can't move further. {column}, position {position} of {count}."
	 */
	keyboardAtEdge: string;
	/**
	 * 键盘放下卡片后的播报，占位符同 `keyboardPickedUp`。
	 * @example "Dropped {card}. {column}, position {position} of {count}."
	 */
	keyboardDropped: string;
	/**
	 * 键盘取消移动后的播报，占位符同 `keyboardPickedUp`。
	 * @example "Move cancelled. {card} is back in {column}, position {position} of {count}."
	 */
	keyboardCancelled: string;
	/**
	 * 通过「移到…」菜单移动后的播报，占位符同 `keyboardPickedUp`。
	 * @example "Moved {card} to {column}, position {position} of {count}."
	 */
	movedByMenu: string;
	/**
	 * 「移到…」菜单的占位选项。
	 * @example "Move to…"
	 */
	moveTo: string;
	/**
	 * 「移到…」菜单的可访问名称，{card} 替换为卡片名称。
	 * @example "Move {card} to another column"
	 */
	moveToLabel: string;
	/**
	 * 折叠列的按钮名称，{column} 替换为列标题。
	 * @example "Collapse {column}"
	 */
	collapseColumn: string;
	/**
	 * 展开列的按钮名称，{column} 替换为列标题。
	 * @example "Expand {column}"
	 */
	expandColumn: string;
	/**
	 * 筛选生效时列内卡片数量，读屏朗读：{matched} 是匹配的数量，{count} 是总数。
	 * @example "Cards: {matched} of {count}"
	 */
	cardCountFiltered: string;
	/**
	 * 筛选生效时，不匹配的卡片上给读屏的提示。
	 * @example "Doesn't match the filter"
	 */
	filteredOut: string;
	/**
	 * 筛选生效、拖动被禁用时看板上的提示。
	 * @example "A filter is on, so cards can't be moved. Clear it to move cards."
	 */
	filterDragDisabled: string;
}

const messagesByLocale: Record<BoardLocale, BoardMessages> = {
	en: {
		boardLabel: "Kanban board",
		cardCount: "Cards: {count}",
		emptyColumn: "No cards",
		autoSorted: "This column is sorted automatically. Cards can't be reordered by hand.",
		moveRejected: "This card can't be moved here.",
		moveFailed: "The move couldn't be saved. The card is back where it was.",
		keyboardHint:
			"Press Space or Enter to pick up this card. Then use the arrow keys to move it, Space or Enter to drop it, and Escape to cancel.",
		keyboardPickedUp:
			"Picked up {card}. {column}, position {position} of {count}. Use the arrow keys to move it, Space or Enter to drop it, Escape to cancel.",
		keyboardMoved: "{column}, position {position} of {count}.",
		keyboardAtEdge: "Can't move further. {column}, position {position} of {count}.",
		keyboardDropped: "Dropped {card}. {column}, position {position} of {count}.",
		keyboardCancelled:
			"Move cancelled. {card} is back in {column}, position {position} of {count}.",
		movedByMenu: "Moved {card} to {column}, position {position} of {count}.",
		moveTo: "Move to…",
		moveToLabel: "Move {card} to another column",
		collapseColumn: "Collapse {column}",
		expandColumn: "Expand {column}",
		cardCountFiltered: "Cards: {matched} of {count}",
		filteredOut: "Doesn't match the filter",
		filterDragDisabled: "A filter is on, so cards can't be moved. Clear it to move cards.",
	},
	"zh-CN": {
		boardLabel: "看板",
		cardCount: "卡片数：{count}",
		emptyColumn: "暂无卡片",
		autoSorted: "该列自动排序，不能手动调整顺序",
		moveRejected: "不能把卡片移到这里",
		moveFailed: "移动未能保存，卡片已回到原位",
		keyboardHint: "按空格或回车拿起这张卡片，然后用方向键移动，空格或回车放下，Esc 取消。",
		keyboardPickedUp:
			"已拿起 {card}。{column}，第 {position} 个，共 {count} 个。用方向键移动，空格或回车放下，Esc 取消。",
		keyboardMoved: "{column}，第 {position} 个，共 {count} 个。",
		keyboardAtEdge: "已到边缘，无法继续移动。{column}，第 {position} 个，共 {count} 个。",
		keyboardDropped: "已放下 {card}。{column}，第 {position} 个，共 {count} 个。",
		keyboardCancelled: "已取消移动。{card} 回到 {column}，第 {position} 个，共 {count} 个。",
		movedByMenu: "已把 {card} 移到 {column}，第 {position} 个，共 {count} 个。",
		moveTo: "移到…",
		moveToLabel: "把 {card} 移到其他列",
		collapseColumn: "折叠 {column}",
		expandColumn: "展开 {column}",
		cardCountFiltered: "卡片数：匹配 {matched}，共 {count}",
		filteredOut: "不符合筛选条件",
		filterDragDisabled: "筛选生效中，不能拖动卡片。清除筛选后再试。",
	},
};

/** 取指定语言的内置文案，再用 `overrides` 中给出的键覆盖。 */
export function resolveMessages(
	locale: BoardLocale = "en",
	overrides?: Partial<BoardMessages>,
): BoardMessages {
	return { ...(messagesByLocale[locale] ?? messagesByLocale.en), ...overrides };
}
