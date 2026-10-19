import type { HTMLAttributes } from "react";
import type { CommandHistory } from "../core/index.ts";
import type { Locale } from "../locale.ts";
import { type HistoryMessages, namedMessage, resolveHistoryMessages } from "./messages.ts";
import { useHistoryAnnouncement } from "./use-history-announcement.ts";
import { useHistoryState } from "./use-history-state.ts";

/** 向辅助技术声明的快捷键，与 `useHistoryShortcuts` 实际响应的组合一致。 */
const UNDO_SHORTCUT = "Control+Z Meta+Z";
const REDO_SHORTCUT = "Control+Shift+Z Meta+Shift+Z Control+Y";

/** `HistoryButtons` 的属性；其余 `div` 属性落在根节点。 */
export interface HistoryButtonsProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
	history: CommandHistory;
	/** 内置文案的语言。 */
	locale?: Locale;
	/** 覆盖内置文案，只需给出要改的键。 */
	messages?: Partial<HistoryMessages>;
}

/**
 * 撤销与重做按钮：没有可执行的步骤时置为不可用，并播报撤销、重做的结果。
 *
 * 按钮的可访问名称就是可见文字；下一步的名称放在 `title` 里。不可用时用 `aria-disabled` 而不是 `disabled`，
 * 这样撤销完最后一步后焦点仍留在按钮上。快捷键由 `useHistoryShortcuts` 提供，两者可以分开使用。
 */
export function HistoryButtons({
	history,
	locale,
	messages: overrides,
	className,
	...rest
}: HistoryButtonsProps) {
	const state = useHistoryState(history);
	const messages = resolveHistoryMessages(locale, overrides);
	const announcement = useHistoryAnnouncement(history, { locale, messages: overrides });
	return (
		<div
			role="group"
			aria-label={messages.historyLabel}
			className={className ? `v-kanban-history ${className}` : "v-kanban-history"}
			{...rest}
		>
			<button
				type="button"
				className="v-kanban-history__button"
				aria-disabled={!state.canUndo}
				aria-keyshortcuts={UNDO_SHORTCUT}
				title={namedMessage(messages.undo, messages.undoNamed, state.undoLabel)}
				onClick={() => void history.undo()}
			>
				{messages.undo}
			</button>
			<button
				type="button"
				className="v-kanban-history__button"
				aria-disabled={!state.canRedo}
				aria-keyshortcuts={REDO_SHORTCUT}
				title={namedMessage(messages.redo, messages.redoNamed, state.redoLabel)}
				onClick={() => void history.redo()}
			>
				{messages.redo}
			</button>
			<div
				role="status"
				aria-live="polite"
				aria-atomic="true"
				className="v-kanban-history__sr-only v-kanban-history__announcer"
			>
				{/* 随结果变化的 key：相同的文本也会作为新内容被播报 */}
				<span key={announcement.seq}>{announcement.text}</span>
			</div>
		</div>
	);
}
