import type { CommandHistory, HistoryState } from "../core/index.ts";
import type { Locale } from "../locale.ts";
import { type HistoryMessages, namedMessage, resolveHistoryMessages } from "./messages.ts";
import { useHistoryState } from "./use-history-state.ts";

export interface HistoryAnnouncementOptions {
	/** 内置文案的语言。 */
	locale?: Locale;
	/** 覆盖内置文案，只需给出要改的键。 */
	messages?: Partial<HistoryMessages>;
}

function describeOutcome(last: HistoryState["last"], messages: HistoryMessages) {
	if (!last) return "";
	const { kind, ok, label } = last;
	if (!ok) return kind === "undo" ? messages.undoFailed : messages.redoFailed;
	return kind === "undo"
		? namedMessage(messages.undone, messages.undoneNamed, label)
		: namedMessage(messages.redone, messages.redoneNamed, label);
}

/**
 * 最近一次撤销或重做的播报文本：成功时说明做了什么，失败时说明这一步已作废。
 *
 * 只用快捷键、不渲染 `HistoryButtons` 的使用方用它把结果放进自己的 `aria-live` 区域。
 *
 * @returns `seq` 每次结果都会变化，把它当作 key 可以让相同的文本也被重新播报
 */
export function useHistoryAnnouncement(
	history: CommandHistory,
	options: HistoryAnnouncementOptions = {},
) {
	const state = useHistoryState(history);
	const messages = resolveHistoryMessages(options.locale, options.messages);
	return { text: describeOutcome(state.last, messages), seq: state.last?.seq ?? 0 };
}
