import {
	autocompletion,
	closeBrackets,
	closeBracketsKeymap,
	completionKeymap,
} from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { go } from "@codemirror/lang-go";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import {
	bracketMatching,
	HighlightStyle,
	indentOnInput,
	syntaxHighlighting,
} from "@codemirror/language";
import { lintKeymap } from "@codemirror/lint";
import { highlightSelectionMatches, searchKeymap, setSearchQuery } from "@codemirror/search";
import { Compartment, EditorState, type Extension, Transaction } from "@codemirror/state";
import {
	crosshairCursor,
	drawSelection,
	dropCursor,
	EditorView,
	highlightActiveLine,
	highlightActiveLineGutter,
	highlightSpecialChars,
	keymap,
	lineNumbers,
	rectangularSelection,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { type CodeMirror, getCM, vim } from "@replit/codemirror-vim";
import { useEffect, useRef, useState } from "react";

/** 页内代码编辑内核的受控内容与交互入口。 */
export interface CodeEditorProps {
	value: string;
	language: string;
	vimEnabled: boolean;
	onChange: (value: string) => void;
	onRun: () => void;
	label: string;
}

type Mode = "normal" | "insert" | "visual";
interface EditorStatus {
	mode: Mode | null;
	pending: string;
	position: string;
	selected: number;
	search: string;
}

const modeLabels = { normal: "普通模式", insert: "插入模式", visual: "可视模式" };
const highlighting = HighlightStyle.define([
	{ tag: tags.keyword, class: "v-code-block__syntax-keyword" },
	{ tag: [tags.string, tags.regexp], class: "v-code-block__syntax-string" },
	{ tag: tags.comment, class: "v-code-block__syntax-comment" },
	{ tag: tags.function(tags.variableName), class: "v-code-block__syntax-function" },
	{ tag: [tags.punctuation, tags.operator], class: "v-code-block__syntax-punctuation" },
	{ tag: [tags.number, tags.bool, tags.null], class: "v-code-block__syntax-keyword" },
]);

const setup: Extension[] = [
	lineNumbers(),
	highlightActiveLineGutter(),
	highlightSpecialChars(),
	history(),
	drawSelection({ cursorBlinkRate: 1000 }),
	dropCursor(),
	EditorState.allowMultipleSelections.of(true),
	indentOnInput(),
	syntaxHighlighting(highlighting),
	bracketMatching(),
	closeBrackets(),
	autocompletion(),
	rectangularSelection(),
	crosshairCursor(),
	highlightActiveLine(),
	highlightSelectionMatches(),
	keymap.of([
		...closeBracketsKeymap,
		...defaultKeymap,
		...searchKeymap,
		...historyKeymap,
		...completionKeymap,
		...lintKeymap,
	]),
];

function languageExtension(language: string): Extension {
	switch (language.toLowerCase()) {
		case "python":
		case "py":
			return python();
		case "javascript":
		case "js":
		case "node":
			return javascript();
		case "bun":
		case "typescript":
		case "ts":
			return javascript({ typescript: true });
		case "go":
			return go();
		case "rust":
		case "rs":
			return rust();
		default:
			return [];
	}
}

function readStatus(view: EditorView): EditorStatus {
	const cm = getCM(view);
	const state = cm?.state.vim;
	const mode = state
		? state.insertMode
			? "insert"
			: state.visualMode
				? "visual"
				: "normal"
		: null;
	const head = view.state.selection.main.head;
	const line = view.state.doc.lineAt(head);
	const query = cm?.cm6Query;
	let search = "";
	if (mode === "normal" && state?.searchState_?.getOverlay() && query?.valid) {
		const cursor = query.getCursor(view.state);
		let current = 0;
		let total = 0;
		for (let match = cursor.next(); !match.done; match = cursor.next()) {
			total++;
			if (head >= match.value.from && head < match.value.to) current = total;
		}
		search = `${current} / ${total}`;
	}
	return {
		mode,
		search,
		pending: mode && mode !== "insert" ? (state?.status ?? "") : "",
		position: state?.visualMode
			? `${state.sel.head.line + 1}:${state.sel.head.ch + 1}`
			: `${line.number}:${head - line.from + 1}`,
		selected: state?.visualMode
			? view.state.selection.ranges.reduce((count, range) => count + range.to - range.from, 0)
			: 0,
	};
}

/** 保留页内草稿、原生 Vim 命令与焦点遍历的 CodeMirror 编辑器。 */
export function CodeEditor(props: CodeEditorProps) {
	const rootRef = useRef<HTMLDivElement>(null);
	const hostRef = useRef<HTMLDivElement>(null);
	const latest = useRef(props);
	latest.current = props;
	const runtime = useRef<{
		view: EditorView;
		setVim: (enabled: boolean) => void;
		language: Compartment;
		label: Compartment;
	} | null>(null);
	const [status, setStatus] = useState<EditorStatus>({
		mode: props.vimEnabled ? "normal" : null,
		pending: "",
		position: "1:1",
		selected: 0,
		search: "",
	});
	const [notice, setNotice] = useState("");
	const [commandOpen, setCommandOpen] = useState(false);
	const [shortcut, setShortcut] = useState("Ctrl↵");

	useEffect(() => {
		const host = hostRef.current;
		const root = rootRef.current;
		if (!host || !root) return;
		const initial = latest.current;
		const vimSlot = new Compartment();
		const languageSlot = new Compartment();
		const labelSlot = new Compartment();
		let disposed = false;
		let detachVim = () => {};
		let closeCommand: (() => void) | undefined;
		const timers = new Set<number>();
		const defer = (callback: () => void) => {
			const timer = window.setTimeout(() => {
				timers.delete(timer);
				if (!disposed) callback();
			}, 0);
			timers.add(timer);
		};
		const attributes = (label: string) =>
			EditorView.contentAttributes.of({
				role: "textbox",
				"aria-multiline": "true",
				"aria-label": label,
			});
		const view = new EditorView({
			parent: host,
			state: EditorState.create({
				doc: initial.value,
				extensions: [
					vimSlot.of(initial.vimEnabled ? vim() : []),
					setup,
					languageSlot.of(languageExtension(initial.language)),
					labelSlot.of(attributes(initial.label)),
					EditorView.updateListener.of((update) => {
						if (update.docChanged) latest.current.onChange(update.state.doc.toString());
						if (update.docChanged || update.selectionSet) syncStatus();
						if (
							update.transactions.some((transaction) =>
								transaction.effects.some((effect) => effect.is(setSearchQuery)),
							)
						) {
							// Vim publishes its overlay after dispatching the search effect.
							defer(syncStatus);
						}
					}),
				],
			}),
		});
		function syncStatus() {
			if (disposed) return;
			const next = readStatus(view);
			setStatus((previous) =>
				previous.mode === next.mode &&
				previous.pending === next.pending &&
				previous.position === next.position &&
				previous.selected === next.selected &&
				previous.search === next.search
					? previous
					: next,
			);
		}
		function attachVim(cm: CodeMirror) {
			const originalDialog = cm.openDialog;
			const originalSave = cm.save;
			cm.save = () => setNotice("修改仅保留在本页，未保存到文章");
			cm.openDialog = (template, callback, options) => {
				const input = template.querySelector("input");
				input?.setAttribute(
					"aria-label",
					template.textContent?.trim().startsWith(":") ? "Vim 命令" : "Vim 搜索",
				);
				setNotice("");
				const close = originalDialog.call(cm, template, callback, {
					...options,
					closeOnBlur: false,
				});
				const closeWithoutFocus = () => {
					// Vim's default close refocuses the editor, which would undo native Tab traversal.
					const focus = cm.focus;
					cm.focus = () => {};
					try {
						close();
					} finally {
						cm.focus = focus;
					}
				};
				closeCommand = closeWithoutFocus;
				input?.addEventListener("blur", () => {
					defer(() => {
						if (document.activeElement !== input) closeWithoutFocus();
					});
				});
				return close;
			};
			const onDialog = () => {
				if (!disposed) setCommandOpen(Boolean(cm.state.dialog));
				if (!cm.state.dialog) closeCommand = undefined;
			};
			for (const event of ["vim-mode-change", "vim-keypress", "vim-command-done"])
				cm.on(event, syncStatus);
			cm.on("dialog", onDialog);
			detachVim = () => {
				closeCommand?.();
				for (const event of ["vim-mode-change", "vim-keypress", "vim-command-done"])
					cm.off(event, syncStatus);
				cm.off("dialog", onDialog);
				cm.openDialog = originalDialog;
				cm.save = originalSave;
				cm.state.currentNotificationClose?.();
			};
		}
		const initialCM = getCM(view);
		if (initialCM) attachVim(initialCM);
		const setVim = (enabled: boolean) => {
			const current = getCM(view);
			if (Boolean(current) === enabled) return;
			if (current?.state.vim) {
				detachVim();
			}
			view.dispatch({ effects: vimSlot.reconfigure(enabled ? vim() : []) });
			const cm = getCM(view);
			if (cm) {
				attachVim(cm);
			}
			setCommandOpen(false);
			syncStatus();
		};
		const captureKey = (event: KeyboardEvent) => {
			if (event.defaultPrevented || event.isComposing) return;
			if (event.key !== "Tab") setNotice("");
			if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
				event.preventDefault();
				event.stopPropagation();
				latest.current.onRun();
				return;
			}
			if (event.key === "Tab") {
				// Do not preventDefault: the browser owns forward/backward focus traversal.
				event.stopPropagation();
				for (const element of root.querySelectorAll<HTMLElement>(
					"input, button, select, textarea, a[href], [tabindex], [contenteditable]",
				)) {
					if (element === event.target) continue;
					const tabIndex = element.getAttribute("tabindex");
					element.tabIndex = -1;
					defer(() => {
						if (tabIndex === null) element.removeAttribute("tabindex");
						else element.setAttribute("tabindex", tabIndex);
					});
				}
			}
		};
		root.addEventListener("keydown", captureKey, true);
		runtime.current = { view, setVim, language: languageSlot, label: labelSlot };
		setShortcut(/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘↵" : "Ctrl↵");
		syncStatus();
		return () => {
			disposed = true;
			detachVim();
			root.removeEventListener("keydown", captureKey, true);
			for (const timer of timers) clearTimeout(timer);
			view.destroy();
			runtime.current = null;
		};
	}, []);

	useEffect(() => {
		runtime.current?.setVim(props.vimEnabled);
	}, [props.vimEnabled]);
	useEffect(() => {
		const editor = runtime.current;
		editor?.view.dispatch({
			effects: editor.language.reconfigure(languageExtension(props.language)),
		});
	}, [props.language]);
	useEffect(() => {
		const editor = runtime.current;
		editor?.view.dispatch({
			effects: editor.label.reconfigure(
				EditorView.contentAttributes.of({
					role: "textbox",
					"aria-multiline": "true",
					"aria-label": props.label,
				}),
			),
		});
	}, [props.label]);
	useEffect(() => {
		const view = runtime.current?.view;
		if (view && view.state.doc.toString() !== props.value) {
			view.dispatch({
				changes: { from: 0, to: view.state.doc.length, insert: props.value },
				annotations: Transaction.addToHistory.of(false),
			});
			setNotice("");
		}
	}, [props.value]);

	return (
		<div
			ref={rootRef}
			className="v-code-block__editor"
			data-mode={status.mode ?? "plain"}
			data-command={commandOpen || undefined}
		>
			<div ref={hostRef} className="v-code-block__editor-host" />
			<div className="v-code-block__status" hidden={commandOpen}>
				{status.mode && (
					<span className="v-code-block__mode">{status.mode.toUpperCase()}</span>
				)}
				<span className="v-code-block__editor-notice">{notice}</span>
				<output
					className="v-code-block__pending"
					aria-label="待完成的 Vim 按键"
					aria-live="off"
				>
					{status.pending}
				</output>
				<output
					className="v-code-block__position"
					aria-label={status.search ? "搜索匹配" : `光标位置 ${status.position}`}
					aria-live="off"
				>
					{status.mode === "visual" && `选中 ${status.selected} · `}
					{status.search || status.position}
				</output>
				<span className="v-code-block__run-hint">
					<kbd className="v-code-block__shortcut">{shortcut}</kbd>
					<span>运行</span>
				</span>
			</div>
			<span
				className="v-code-block__editor-announcement"
				role="status"
				aria-label="代码编辑状态"
				aria-live="polite"
				aria-atomic="true"
			>
				{notice ||
					(commandOpen
						? "Vim 命令输入"
						: status.mode
							? modeLabels[status.mode]
							: "Vim 已关闭")}
			</span>
		</div>
	);
}
