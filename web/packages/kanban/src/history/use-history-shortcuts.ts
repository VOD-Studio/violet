import { type RefObject, useEffect } from "react";
import type { CommandHistory } from "../core/index.ts";
import { EDITABLE_SELECTOR } from "../editable.ts";

/** `useHistoryShortcuts` 的选项。 */
export interface HistoryShortcutsOptions {
	/**
	 * 关闭时不监听快捷键。
	 * @default true
	 */
	enabled?: boolean;
	/**
	 * 只响应发生在这个元素内的按键；元素还没有挂载时不监听。
	 * @default document
	 */
	scope?: RefObject<HTMLElement | null>;
}

/**
 * 撤销重做的快捷键：Ctrl/⌘+Z 撤销，Ctrl/⌘+Shift+Z 或 Ctrl+Y 重做。
 *
 * 输入控件与可编辑文本里留给它们自己的撤销，不拦截（包括 Shadow DOM 里的）；带 Alt、输入法组合期间
 * 与已被处理的事件也不响应。
 */
export function useHistoryShortcuts(
	history: CommandHistory,
	options: HistoryShortcutsOptions = {},
) {
	const { enabled = true, scope } = options;
	useEffect(() => {
		if (!enabled) return;
		let target: EventTarget = document;
		if (scope) {
			if (!scope.current) return;
			target = scope.current;
		}
		const onKeyDown = (event: Event) => {
			const key = event as KeyboardEvent;
			if (key.defaultPrevented || key.isComposing || key.altKey) return;
			if (!(key.ctrlKey || key.metaKey)) return;
			const letter = key.key.toLowerCase();
			const redo =
				(letter === "z" && key.shiftKey) ||
				(letter === "y" && key.ctrlKey && !key.shiftKey);
			const undo = letter === "z" && !key.shiftKey;
			if (!undo && !redo) return;
			// 事件穿过 Shadow DOM 时 target 被重定向成宿主，真正的来源在 composedPath 的第一项
			const source = (key.composedPath?.()[0] ?? key.target) as Element | null;
			if (source?.closest?.(EDITABLE_SELECTOR)) return;
			key.preventDefault();
			void (undo ? history.undo() : history.redo());
		};
		target.addEventListener("keydown", onKeyDown);
		return () => target.removeEventListener("keydown", onKeyDown);
	}, [history, enabled, scope]);
}
