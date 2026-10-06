import type { Editor } from "@tiptap/core";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	type BlockLineEntry,
	buildBlockLineMap,
	findBlockByLine,
	findVisibleBlockPos,
} from "../lib/markdown-position";
import type { MarkdownSourceHandle } from "../ui/MarkdownSourceEditor";

interface MarkdownSourceOptions {
	editor: Editor | null;
	value: string;
	contentType: "html" | "markdown";
	onChange: (content: string) => void;
	scrollContainer: HTMLElement | null;
}

function buildBlockMap(editor: Editor): ReadonlyArray<BlockLineEntry> {
	if (!editor.markdown) return [];
	const json = editor.getJSON();
	const blocks: Array<readonly [number, string]> = [];
	editor.state.doc.forEach((_node, pos, index) => {
		const markdown = editor.markdown?.renderNodeToMarkdown(
			json.content?.[index],
			json,
			index,
			0,
		);
		blocks.push([pos, markdown ?? ""]);
	});
	return buildBlockLineMap(blocks);
}

interface MarkdownSourceState {
	sourceMode: boolean;
	sourceText: string;
	sourceEditorRef: React.RefObject<MarkdownSourceHandle | null>;
	pendingSourceLine: number | null;
	changeSource: (text: string) => void;
	toggleSourceMode: () => void;
	getMarkdown: () => string;
}

/** 源码输入同步到同一份 Tiptap 文档；受控回填不报告为用户编辑。 */
export function useMarkdownSource({
	editor,
	value,
	contentType,
	onChange,
	scrollContainer,
}: MarkdownSourceOptions): MarkdownSourceState {
	const [sourceMode, setSourceMode] = useState(false);
	const [sourceText, setSourceText] = useState("");
	const sourceRef = useRef({ active: false, text: "" });
	const sourceEditorRef = useRef<MarkdownSourceHandle | null>(null);
	const [pendingSourceLine, setPendingSourceLine] = useState<number | null>(null);
	const pendingBlockPosRef = useRef<number | null>(null);
	const applyingValueRef = useRef(false);
	const editingSourceRef = useRef(false);
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;

	const getMarkdown = useCallback(
		() => (sourceRef.current.active ? sourceRef.current.text : (editor?.getMarkdown() ?? "")),
		[editor],
	);

	useEffect(() => {
		if (!editor) return;
		const notifyChange = () => {
			if (editor.isDestroyed || !editor.schema || applyingValueRef.current) return;
			// 图片插入、文件导入等命令也必须回填当前可见的源码。
			if (sourceRef.current.active && !editingSourceRef.current) {
				sourceRef.current.text = editor.getMarkdown();
				setSourceText(sourceRef.current.text);
			}
			onChangeRef.current(contentType === "markdown" ? getMarkdown() : editor.getHTML());
		};
		editor.on("update", notifyChange);
		return () => {
			editor.off("update", notifyChange);
		};
	}, [editor, contentType, getMarkdown]);

	useEffect(() => {
		if (!editor || editor.isDestroyed || !editor.schema) return;
		const current = contentType === "markdown" ? getMarkdown() : editor.getHTML();
		if (value === current) return;
		// NodeView 的挂载不能在 React 提交期间同步触发 flushSync。
		const timer = setTimeout(() => {
			if (editor.isDestroyed || !editor.schema) return;
			applyingValueRef.current = true;
			try {
				editor.commands.setContent(value, { contentType, emitUpdate: true });
				if (sourceRef.current.active) {
					sourceRef.current.text =
						contentType === "markdown" ? value : editor.getMarkdown();
					setSourceText(sourceRef.current.text);
				}
			} finally {
				applyingValueRef.current = false;
			}
		}, 0);
		return () => clearTimeout(timer);
	}, [value, editor, contentType, getMarkdown]);

	const changeSource = (text: string) => {
		if (!editor || text === sourceRef.current.text) return;
		sourceRef.current.text = text;
		setSourceText(text);
		editingSourceRef.current = true;
		try {
			editor.commands.setContent(text, { contentType: "markdown" });
		} finally {
			editingSourceRef.current = false;
		}
	};

	const toggleSourceMode = () => {
		if (!editor) return;
		const map = buildBlockMap(editor);
		if (!sourceRef.current.active) {
			const containerTop = scrollContainer?.getBoundingClientRect().top ?? 0;
			const blockTops: Array<readonly [number, number]> = [];
			for (const entry of map) {
				const dom = editor.view.nodeDOM(entry.pmPos) as HTMLElement | null;
				if (dom)
					blockTops.push([
						entry.pmPos,
						dom.getBoundingClientRect().bottom - containerTop,
					]);
			}
			const visiblePos = findVisibleBlockPos(blockTops);
			setPendingSourceLine(map.find((entry) => entry.pmPos === visiblePos)?.mdStartLine ?? 0);
			sourceRef.current = { active: true, text: editor.getMarkdown() };
			setSourceText(sourceRef.current.text);
		} else {
			pendingBlockPosRef.current = findBlockByLine(
				map,
				sourceEditorRef.current?.getVisibleLine() ?? 0,
			);
			sourceRef.current.active = false;
		}
		setSourceMode(sourceRef.current.active);
	};

	useEffect(() => {
		if (sourceMode || pendingBlockPosRef.current == null || !editor || !scrollContainer) return;
		const pos = pendingBlockPosRef.current;
		const frame = requestAnimationFrame(() => {
			if (editor.isDestroyed) return;
			const dom = editor.view.nodeDOM(pos) as HTMLElement | null;
			if (dom) {
				const delta =
					dom.getBoundingClientRect().top - scrollContainer.getBoundingClientRect().top;
				const max = scrollContainer.scrollHeight - scrollContainer.clientHeight;
				scrollContainer.scrollTop = Math.max(
					0,
					Math.min(max, scrollContainer.scrollTop + delta),
				);
			}
			pendingBlockPosRef.current = null;
		});
		return () => cancelAnimationFrame(frame);
	}, [sourceMode, editor, scrollContainer]);

	return {
		sourceMode,
		sourceText,
		sourceEditorRef,
		pendingSourceLine,
		changeSource,
		toggleSourceMode,
		getMarkdown,
	};
}
