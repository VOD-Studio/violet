/**
 * oneDark 主题 Extension —— CodeMirror 编辑器主题
 *
 * 对齐 @codemirror/theme-one-dark 的配色（github-dark），与阅读页 shiki
 * github-dark 主题视觉一致。手写而非引依赖，减少包体积。
 *
 * 编辑器背景固定 #282c34（比阅读页代码区 #24292e 略亮，便于区分可编辑区）。
 */
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

/** 编辑器 UI 主题（背景、光标、选区、行号等） */
const editorTheme = EditorView.theme(
    {
        "&": {
            backgroundColor: "#282c34",
            color: "#abb2bf",
            fontSize: "13px",
            height: "100%",
        },
        ".cm-content": {
            caretColor: "#528bff",
            fontFamily: '"Maple Mono", ui-monospace, monospace',
            padding: "8px 0",
        },
        ".cm-gutters": {
            backgroundColor: "#282c34",
            color: "#5c6370",
            border: "none",
        },
        ".cm-activeLine": { backgroundColor: "#2c313a" },
        ".cm-activeLineGutter": { backgroundColor: "#2c313a" },
        ".cm-selectionBackground, ::selection": { backgroundColor: "#3e4451" },
        ".cm-cursor": { borderLeftColor: "#528bff" },
        ".cm-matchingBracket": { backgroundColor: "#515a6b", outline: "1px solid #515a6b" },
        // 滚动条与代码块一致
        "& ::-webkit-scrollbar": { height: "8px", width: "8px" },
        "& ::-webkit-scrollbar-thumb": { backgroundColor: "#4b5263", borderRadius: "4px" },
        "& ::-webkit-scrollbar-track": { backgroundColor: "transparent" },
        // foldGutter 三角颜色
        ".cm-gutterElement": { color: "#5c6370" },
    },
    { dark: true },
);

/** 语法高亮配色（one-dark 调色板），用 @codemirror/language 的 tags */
const highlightStyle = HighlightStyle.define([
    { tag: t.comment, color: "#5c6370", fontStyle: "italic" },
    { tag: t.variableName, color: "#e06c75" },
    { tag: t.string, color: "#98c379" },
    { tag: t.number, color: "#d19a66" },
    { tag: [t.keyword, t.controlKeyword, t.operatorKeyword], color: "#c678dd" },
    { tag: t.function(t.variableName), color: "#61afef" },
    { tag: [t.typeName, t.className], color: "#e5c07b" },
    { tag: t.tagName, color: "#e06c75" },
    { tag: t.attributeName, color: "#d19a66" },
    { tag: t.propertyName, color: "#e06c75" },
    { tag: t.operator, color: "#56b6c2" },
    { tag: t.punctuation, color: "#abb2bf" },
    { tag: t.meta, color: "#abb2bf" },
]);

/** 完整主题 Extension（UI + 语法高亮） */
export const oneDark: Extension[] = [editorTheme, syntaxHighlighting(highlightStyle)];
