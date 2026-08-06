/**
 * MarkdownSourceEditor - 源码模式的 CodeMirror 6 封装。
 *
 * 替代 textarea + scroll-mirror 方案：CM6 每行是真实 DOM 节点，
 * 「行号 ↔ 滚动位置」是原生能力（lineBlockAtHeight / scrollIntoView），
 * 无需镜像 div 复刻 pre-wrap 换行规则。块级映射（markdown-position）
 * 与编辑器底座无关，保留在调用方。
 */

import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { LanguageDescription } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import {
	drawSelection,
	EditorView,
	highlightActiveLine,
	highlightActiveLineGutter,
	keymap,
	lineNumbers,
} from "@codemirror/view";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

/** 源码模式编辑器的命令式句柄：行号 ↔ 滚动换算由 CM6 原生提供 */
export interface MarkdownSourceHandle {
	/** 滚到第 N 行(0 基)顶部 */
	scrollToLine: (line: number) => void;
	/** 视口顶部所在的行号(0 基) */
	getVisibleLine: () => number;
}

interface MarkdownSourceEditorProps {
	value: string;
	onChange: (value: string) => void;
	minHeight: number;
	/** mount 后要滚到的目标行（0 基）；null=停在顶部。切换源码时由父组件传入 */
	initialScrollLine?: number | null;
}

/** 围栏代码块内嵌高亮：按语言懒加载官方包（js/ts/python），其余纯文本 */
const codeLanguages: readonly LanguageDescription[] = [
	LanguageDescription.of({
		name: "javascript",
		alias: ["js"],
		load: () => import("@codemirror/lang-javascript").then((m) => m.javascript()),
	}),
	LanguageDescription.of({
		name: "typescript",
		alias: ["ts"],
		load: () =>
			import("@codemirror/lang-javascript").then((m) => m.javascript({ typescript: true })),
	}),
	LanguageDescription.of({
		name: "python",
		alias: ["py"],
		load: () => import("@codemirror/lang-python").then((m) => m.python()),
	}),
];

/** 源码模式主题：跟随 Tailwind token，与富文本容器视觉一致 */
const sourceTheme = EditorView.theme({
	"&": {
		height: "100%",
		backgroundColor: "transparent",
	},
	".cm-scroller": {
		fontFamily: "inherit",
		lineHeight: "1.625", // leading-relaxed，与原 textarea 一致
	},
	".cm-content": {
		padding: "1rem 1rem 2rem", // 原 p-4；底部留白避免末行贴底
		caretColor: "var(--color-foreground)",
	},
	".cm-gutters": {
		backgroundColor: "transparent",
		border: "none",
		color: "var(--color-muted-foreground)",
		paddingLeft: "0.75rem",
	},
	".cm-activeLine": {
		backgroundColor: "color-mix(in oklab, var(--color-muted) 50%, transparent)",
	},
	".cm-activeLineGutter": {
		backgroundColor: "transparent",
	},
	"&.cm-focused": {
		outline: "none",
	},
});

export const MarkdownSourceEditor = forwardRef<MarkdownSourceHandle, MarkdownSourceEditorProps>(
	function MarkdownSourceEditor({ value, onChange, minHeight, initialScrollLine }, ref) {
		const containerRef = useRef<HTMLDivElement | null>(null);
		const viewRef = useRef<EditorView | null>(null);
		// 存最新回调避免重建实例（闭包陈旧问题）
		const onChangeRef = useRef(onChange);
		onChangeRef.current = onChange;

		/** 把第 line 行(0 基)滚到视口顶部。
		 * 多阶段滚动：CM6 对视口外的行用估算高度（半角 charWidth 基准，中文
		 * 全角段落偏差可达数倍）。第一次估算滚动后，目标行进入「视口 ±1000px
		 * margin」实测区；链式 requestMeasure 的 write 在每次 measure 完整后
		 * 执行，后续滚动基于已实测的行高，逐次收敛到精确位置。 */
		const applyScrollToLine = (view: EditorView, line: number) => {
			const { doc } = view.state;
			const lineNo = Math.min(Math.max(line + 1, 1), doc.lines);
			const pos = doc.line(lineNo).from;
			const scrollTo = () => {
				view.dispatch({
					effects: EditorView.scrollIntoView(pos, { y: "start" }),
				});
			};
			const chain = (depth: number) => {
				view.requestMeasure({
					read: () => true,
					write: () => {
						scrollTo();
						if (depth > 0) chain(depth - 1);
					},
				});
			};
			scrollTo();
			chain(2);
		};

		// mount 创建实例。依赖空数组——只用 ref 读最新回调，避免重建实例丢失光标/撤销栈。
		// 滚动在 view 创建后同步执行（不依赖父组件 effect 时序）：StrictMode 双挂载
		// 下两个 view 各滚一次，幂等，最终实例必然停在目标行。
		// biome-ignore lint/correctness/useExhaustiveDependencies: 刻意只 mount 一次
		useEffect(() => {
			if (!containerRef.current) return;
			const view = new EditorView({
				state: EditorState.create({
					doc: value,
					extensions: [
						lineNumbers(),
						highlightActiveLine(),
						highlightActiveLineGutter(),
						EditorView.lineWrapping,
						history(),
						drawSelection(),
						markdown({ codeLanguages }),
						keymap.of([...defaultKeymap, ...historyKeymap]),
						sourceTheme,
						EditorView.updateListener.of((v) => {
							if (v.docChanged) {
								onChangeRef.current?.(v.state.doc.toString());
							}
						}),
					],
				}),
				parent: containerRef.current,
			});
			viewRef.current = view;
			if (initialScrollLine != null) {
				applyScrollToLine(view, initialScrollLine);
			}
			return () => {
				view.destroy();
				viewRef.current = null;
			};
		}, []);

		useImperativeHandle(
			ref,
			() => ({
				// CM6 行号 1 基，接口 0 基；clamp 到文档行数内
				scrollToLine: (line) => {
					const view = viewRef.current;
					if (!view) return;
					applyScrollToLine(view, line);
				},
				getVisibleLine: () => {
					const view = viewRef.current;
					if (!view) return 0;
					// 视口顶部所在的行块 → 行号（1 基转 0 基）
					const block = view.lineBlockAtHeight(view.scrollDOM.scrollTop);
					return view.state.doc.lineAt(block.from).number - 1;
				},
			}),
			[],
		);

		return (
			<div
				ref={containerRef}
				className="flex-1 overflow-hidden font-mono text-sm"
				style={{ minHeight }}
			/>
		);
	},
);
