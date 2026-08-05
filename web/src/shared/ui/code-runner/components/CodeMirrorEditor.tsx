/**
 * CodeMirrorEditor - CodeMirror React 封装（可编辑代码 + Vim 模式）
 *
 * 照搬 yggdrasil libs/codemirror-editor/src/editor.ts：
 *   - basicSetup（lineNumbers、history、foldGutter、bracketMatching、autocompletion）
 *   - 四个 Compartment（theme/language/vim）支持 reconfigure 热切换，不重建实例
 *   - Vim 由 @replit/codemirror-vim 提供，vim 必须在 keymap 最前（库要求）
 *   - Ctrl/Cmd+Enter 运行快捷键（Prec.highest 保证在 vim 拦截前命中）
 *
 * 与 ygggrasil 区别：去掉 SQL 补全 schema（code-runner 只跑通用语言），
 * 主题用 github-dark（与阅读页 shiki 高亮一致），简化 language 映射。
 */
import {
	autocompletion,
	closeBrackets,
	closeBracketsKeymap,
	completionKeymap,
} from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import {
	bracketMatching,
	codeFolding,
	defaultHighlightStyle,
	foldGutter,
	foldKeymap,
	indentOnInput,
	syntaxHighlighting,
} from "@codemirror/language";
import { lintKeymap } from "@codemirror/lint";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { Compartment, EditorState, type Extension, Prec } from "@codemirror/state";
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
import { vim } from "@replit/codemirror-vim";
import { useEffect, useRef } from "react";
import { oneDark } from "./one-dark-theme";

export interface CodeMirrorEditorProps {
	/** 初始代码内容 */
	value: string;
	/** 语言（canonical key：python/node/go/rust/bun） */
	language: string;
	/** 是否启用 Vim keymap */
	vim: boolean;
	/** 代码变更回调 */
	onChange?: (value: string) => void;
	/** Ctrl/Cmd+Enter 运行快捷键回调 */
	onRunShortcut?: () => void;
}

/**
 * basicSetup：与 @codemirror/basic-setup 一致，折叠图标换成稳定三角形字符。
 *
 * 照搬 yggdrasil editor.ts：默认 foldGutter 用 "⌄"（字形不稳），改 "▾"/"▸"
 * （几何形状块字符，居中稳定）。
 */
const basicSetup: Extension[] = [
	lineNumbers(),
	highlightActiveLineGutter(),
	highlightSpecialChars(),
	history(),
	foldGutter({ openText: "▾", closedText: "▸" }),
	drawSelection(),
	dropCursor(),
	EditorState.allowMultipleSelections.of(true),
	indentOnInput(),
	syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
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
		...foldKeymap,
		...completionKeymap,
		...lintKeymap,
	]),
	codeFolding(),
];

/** 语言 → CodeMirror Extension 映射 */
function buildLanguageExtension(lang: string): Extension {
	const normalized = (lang ?? "").toLowerCase();
	if (normalized === "python") return python();
	if (normalized === "node" || normalized === "javascript" || normalized === "js")
		return javascript();
	if (normalized === "bun" || normalized === "typescript" || normalized === "ts") {
		return javascript({ typescript: true });
	}
	// go/rust 暂无 CodeMirror 官方语言包，降级为纯文本高亮
	return [];
}

/**
 * CodeMirror 编辑器组件。
 *
 * 用四个 Compartment 注入 theme/language/vim，支持 reconfigure 热切换。
 * 实例在 mount 时创建，unmount 时销毁。
 */
export function CodeMirrorEditor({
	value,
	language,
	vim: vimEnabled,
	onChange,
	onRunShortcut,
}: CodeMirrorEditorProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const viewRef = useRef<EditorView | null>(null);
	const themeCompartment = useRef(new Compartment());
	const languageCompartment = useRef(new Compartment());
	const vimCompartment = useRef(new Compartment());
	// 存最新回调避免重建实例（闭包陈旧问题）
	const onChangeRef = useRef(onChange);
	const onRunRef = useRef(onRunShortcut);
	onChangeRef.current = onChange;
	onRunRef.current = onRunShortcut;

	// mount：创建实例。依赖空数组——只用 ref 读最新回调，避免重建实例丢失光标/撤销栈
	// biome-ignore lint/correctness/useExhaustiveDependencies: 刻意只 mount 一次
	useEffect(() => {
		if (!containerRef.current) return;
		const view = new EditorView({
			state: EditorState.create({
				doc: value,
				extensions: [
					basicSetup,
					// Ctrl/Cmd+Enter 运行：Prec.highest 保证在 vim 拦截前命中
					...(onRunShortcut
						? [
								Prec.highest(
									keymap.of([
										{
											key: "Mod-Enter",
											preventDefault: true,
											run: () => {
												onRunRef.current?.();
												return true;
											},
										},
									]),
								),
							]
						: []),
					// vim 必须在 keymap 最前（@replit/codemirror-vim 仓库要求）
					vimCompartment.current.of(vimEnabled ? [vim()] : []),
					themeCompartment.current.of(oneDark),
					languageCompartment.current.of(buildLanguageExtension(language)),
					EditorView.updateListener.of((v) => {
						if (v.docChanged) {
							onChangeRef.current?.(view.state.doc.toString());
						}
					}),
				],
			}),
			parent: containerRef.current,
		});
		viewRef.current = view;
		return () => {
			view.destroy();
			viewRef.current = null;
		};
	}, []);

	// vim 切换：reconfigure，不重建实例（保留 Vim 状态/光标/撤销栈）
	useEffect(() => {
		viewRef.current?.dispatch({
			effects: vimCompartment.current.reconfigure(vimEnabled ? [vim()] : []),
		});
	}, [vimEnabled]);

	// 语言切换：reconfigure
	useEffect(() => {
		viewRef.current?.dispatch({
			effects: languageCompartment.current.reconfigure(buildLanguageExtension(language)),
		});
	}, [language]);

	return <div ref={containerRef} className="code-mirror-host" />;
}
