import { formatMessage, type Locale } from "../locale.ts";

/**
 * 撤销重做按钮的可覆盖文案。
 *
 * {label} 替换为这一步的名称，纯文本。
 */
export interface HistoryMessages {
	/** 按钮组的可访问名称。 */
	historyLabel: string;
	/** 撤销按钮上显示的文字。 */
	undo: string;
	/** 重做按钮上显示的文字。 */
	redo: string;
	/**
	 * 知道下一步撤销的名称时，撤销按钮的可访问名称。
	 * @example "Undo {label}"
	 */
	undoNamed: string;
	/** 重做按钮的可访问名称，占位符同 `undoNamed`。 */
	redoNamed: string;
	/** 撤销成功的播报。 */
	undone: string;
	/** 撤销成功且知道名称时的播报。 */
	undoneNamed: string;
	/** 重做成功的播报。 */
	redone: string;
	/** 重做成功且知道名称时的播报。 */
	redoneNamed: string;
	/** 撤销失败、该步作废的播报。 */
	undoFailed: string;
	/** 重做失败、该步作废的播报。 */
	redoFailed: string;
}

const messagesByLocale: Record<Locale, HistoryMessages> = {
	en: {
		historyLabel: "History",
		undo: "Undo",
		redo: "Redo",
		undoNamed: "Undo {label}",
		redoNamed: "Redo {label}",
		undone: "Undone.",
		undoneNamed: "Undone: {label}.",
		redone: "Redone.",
		redoneNamed: "Redone: {label}.",
		undoFailed: "Couldn't undo. That step was discarded.",
		redoFailed: "Couldn't redo. That step was discarded.",
	},
	"zh-CN": {
		historyLabel: "历史",
		undo: "撤销",
		redo: "重做",
		undoNamed: "撤销{label}",
		redoNamed: "重做{label}",
		undone: "已撤销。",
		undoneNamed: "已撤销：{label}。",
		redone: "已重做。",
		redoneNamed: "已重做：{label}。",
		undoFailed: "撤销失败，这一步已作废。",
		redoFailed: "重做失败，这一步已作废。",
	},
};

/** 取指定语言的内置文案，再用 `overrides` 中给出的键覆盖。 */
export function resolveHistoryMessages(
	locale: Locale = "en",
	overrides?: Partial<HistoryMessages>,
): HistoryMessages {
	return { ...(messagesByLocale[locale] ?? messagesByLocale.en), ...overrides };
}

/** 有名称时用带名称的模板，否则用不带名称的文案。 */
export const namedMessage = (plain: string, template: string, label?: string) =>
	label ? formatMessage(template, { label }) : plain;
