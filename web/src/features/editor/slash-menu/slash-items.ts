/**
 * slash-items - 斜杠命令菜单的可选项定义
 *
 * 每个项描述：图标 / 标题 / 描述 / 关键词 / 执行命令（操作编辑器）。
 * SlashMenu 组件按 query 过滤 title/keywords 后渲染，选中后调 command。
 */
import type { Editor } from "@tiptap/react";
import type { LucideIcon } from "lucide-react";
import {
    Code2,
    Heading1,
    Heading2,
    Heading3,
    Image as ImageIcon,
    List,
    ListOrdered,
    ListTodo,
    Minus,
    Play,
    Quote,
    Sigma,
    SquareFunction,
    Table as TableIcon,
    Text,
    Workflow,
} from "lucide-react";

export interface SlashMenuItem {
    /** 唯一标识 */
    id: string;
    /** 显示标题 */
    title: string;
    /** 副标题描述 */
    description: string;
    /** 关键词，用于搜索匹配（含别名） */
    keywords: string[];
    /** 图标 */
    icon: LucideIcon;
    /** 别名分组，仅用于排序/分类 */
    group: string;
    /** 执行命令 */
    command: (editor: Editor) => void;
}

/** 图片插入项的 command 由父组件注入（需触发上传/素材选择），此处用占位 id 标记 */
export const IMAGE_ITEM_ID = "image";

/**
 * insertContentAt 后在 from 附近定位刚插入的公式节点并选中。
 * 不用官方 insertInlineMath/insertBlockMath：它们对空 latex 直接返回 false，
 * 后续 setNodeSelection 会在无节点位置抛 TypeError（slash 插入无反应的根源）。
 * 块节点落点随上下文偏移（空段落被替换时落在 from-1），故就近搜索。
 */
function selectInsertedMath(editor: Editor, type: "inlineMath" | "blockMath", from: number) {
    for (const pos of [from, from - 1, from + 1]) {
        if (pos >= 0 && editor.state.doc.nodeAt(pos)?.type.name === type) {
            editor.chain().setNodeSelection(pos).run();
            return;
        }
    }
}

export function buildSlashItems(onPickImage: () => void): SlashMenuItem[] {
    return [
        {
            id: "text",
            title: "正文",
            description: "普通段落文本",
            keywords: ["paragraph", "正文", "段落", "p"],
            icon: Text,
            group: "基础",
            command: (e) => e.chain().focus().setParagraph().run(),
        },
        {
            id: "h1",
            title: "一级标题",
            description: "大标题",
            keywords: ["h1", "标题", "heading", "title"],
            icon: Heading1,
            group: "基础",
            command: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
        },
        {
            id: "h2",
            title: "二级标题",
            description: "中标题",
            keywords: ["h2", "标题", "heading", "subtitle"],
            icon: Heading2,
            group: "基础",
            command: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
        },
        {
            id: "h3",
            title: "三级标题",
            description: "小标题",
            keywords: ["h3", "标题", "heading"],
            icon: Heading3,
            group: "基础",
            command: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
        },
        {
            id: "bulletList",
            title: "无序列表",
            description: "圆点列表",
            keywords: ["ul", "bullet", "list", "列表", "无序"],
            icon: List,
            group: "列表",
            command: (e) => e.chain().focus().toggleBulletList().run(),
        },
        {
            id: "orderedList",
            title: "有序列表",
            description: "数字列表",
            keywords: ["ol", "ordered", "list", "列表", "有序", "数字"],
            icon: ListOrdered,
            group: "列表",
            command: (e) => e.chain().focus().toggleOrderedList().run(),
        },
        {
            id: "taskList",
            title: "任务列表",
            description: "可勾选的待办",
            keywords: ["task", "todo", "checklist", "任务", "待办", "勾选"],
            icon: ListTodo,
            group: "列表",
            command: (e) => e.chain().focus().toggleTaskList().run(),
        },
        {
            id: "blockquote",
            title: "引用",
            description: "引用块",
            keywords: ["quote", "blockquote", "引用"],
            icon: Quote,
            group: "块",
            command: (e) => e.chain().focus().toggleBlockquote().run(),
        },
        {
            id: "codeBlock",
            title: "代码块",
            description: "带高亮的代码块",
            keywords: ["code", "codeblock", "代码", "pre"],
            icon: Code2,
            group: "块",
            command: (e) => e.chain().focus().toggleCodeBlock().run(),
        },
        {
            id: "runnableCodeBlock",
            title: "可运行代码块",
            description: "读者可点击运行的代码（python/node/go/rust/bun）",
            keywords: ["run", "runnable", "execute", "运行", "可运行", "playground"],
            icon: Play,
            group: "块",
            command: (e) =>
                e
                    .chain()
                    .focus()
                    .insertContent({
                        type: "codeBlock",
                        attrs: { language: "python", runnable: true },
                    })
                    .run(),
        },
        {
            id: "hr",
            title: "分割线",
            description: "水平分隔线",
            keywords: ["hr", "horizontal", "rule", "分割", "分隔"],
            icon: Minus,
            group: "块",
            command: (e) => e.chain().focus().setHorizontalRule().run(),
        },
        {
            id: "table",
            title: "表格",
            description: "插入 3×3 表格",
            keywords: ["table", "表格"],
            icon: TableIcon,
            group: "块",
            command: (e) =>
                e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
        },
        {
            id: "inlineMath",
            title: "行内公式",
            description: "LaTeX 行内数学公式（$...$）",
            keywords: ["math", "inline", "公式", "latex", "katex"],
            icon: Sigma,
            group: "媒体",
            command: (e) => {
                const { from } = e.state.selection;
                const inserted = e
                    .chain()
                    .focus()
                    .insertContentAt(from, { type: "inlineMath", attrs: { latex: "" } })
                    .run();
                if (inserted) selectInsertedMath(e, "inlineMath", from);
            },
        },
        {
            id: "blockMath",
            title: "公式块",
            description: "LaTeX 独立行数学公式（$$...$$）",
            keywords: ["math", "block", "公式", "latex", "katex"],
            icon: SquareFunction,
            group: "媒体",
            command: (e) => {
                const { from } = e.state.selection;
                const inserted = e
                    .chain()
                    .focus()
                    .insertContentAt(from, { type: "blockMath", attrs: { latex: "" } })
                    .run();
                if (inserted) selectInsertedMath(e, "blockMath", from);
            },
        },
        {
            id: "diagramBlock",
            title: "流程图",
            description: "Mermaid 流程图 / 时序图（```mermaid 围栏块）",
            keywords: ["diagram", "mermaid", "flowchart", "流程图", "时序图", "图", "sequence"],
            icon: Workflow,
            group: "媒体",
            command: (e) =>
                e
                    .chain()
                    .focus()
                    .insertContent({
                        type: "diagramBlock",
                        attrs: { format: "mermaid", source: "" },
                    })
                    .run(),
        },
        {
            id: IMAGE_ITEM_ID,
            title: "图片",
            description: "插入图片（上传/素材库）",
            keywords: ["image", "图片", "upload", "photo", "picture"],
            icon: ImageIcon,
            group: "媒体",
            command: () => onPickImage(),
        },
    ];
}
