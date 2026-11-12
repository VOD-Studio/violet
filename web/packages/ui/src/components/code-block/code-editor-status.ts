import type { EditorView } from "@codemirror/view";
import { type CodeMirror, getCM } from "@replit/codemirror-vim";

type Mode = "normal" | "insert" | "visual";

export interface EditorStatus {
	mode: Mode | null;
	pending: string;
	position: string;
	selected: number;
	search: string;
}

const modeLabels = { normal: "普通模式", insert: "插入模式", visual: "可视模式" };

function readMode(state: CodeMirror["state"]["vim"]): Mode | null {
	if (!state) {
		return null;
	}
	if (state.insertMode) {
		return "insert";
	}
	if (state.visualMode) {
		return "visual";
	}
	return "normal";
}

export function readStatus(view: EditorView): EditorStatus {
	const cm = getCM(view);
	const state = cm?.state.vim;
	const mode = readMode(state);
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
			if (head >= match.value.from && head < match.value.to) {
				current = total;
			}
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

export function editorAnnouncement(
	notice: string,
	commandOpen: boolean,
	mode: EditorStatus["mode"],
): string {
	if (notice) {
		return notice;
	}
	if (commandOpen) {
		return "Vim 命令输入";
	}
	if (mode) {
		return modeLabels[mode];
	}
	return "Vim 已关闭";
}
