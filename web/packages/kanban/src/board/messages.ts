/** 内置文案的语言。 */
export type BoardLocale = "en" | "zh-CN";

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
}

const messagesByLocale: Record<BoardLocale, BoardMessages> = {
	en: {
		boardLabel: "Kanban board",
		cardCount: "Cards: {count}",
		emptyColumn: "No cards",
		autoSorted: "This column is sorted automatically. Cards can't be reordered by hand.",
		moveRejected: "This card can't be moved here.",
		moveFailed: "The move couldn't be saved. The card is back where it was.",
	},
	"zh-CN": {
		boardLabel: "看板",
		cardCount: "卡片数：{count}",
		emptyColumn: "暂无卡片",
		autoSorted: "该列自动排序，不能手动调整顺序",
		moveRejected: "不能把卡片移到这里",
		moveFailed: "移动未能保存，卡片已回到原位",
	},
};

/** 取指定语言的内置文案，再用 `overrides` 中给出的键覆盖。 */
export function resolveMessages(
	locale: BoardLocale = "en",
	overrides?: Partial<BoardMessages>,
): BoardMessages {
	return { ...(messagesByLocale[locale] ?? messagesByLocale.en), ...overrides };
}

/** 把模板中的 `{name}` 替换为对应值；没有给出的占位符原样保留。 */
export function formatMessage(template: string, values: Record<string, string | number>): string {
	return template.replace(/\{(\w+)\}/g, (match, name: string) =>
		name in values ? String(values[name]) : match,
	);
}
