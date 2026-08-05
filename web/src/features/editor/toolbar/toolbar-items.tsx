/**
 * toolbar-items - 工具栏按钮辅助定义
 *
 * 每个 ToolbarItem 描述一个工具按钮：图标 / 标题 / 执行命令 / 判断激活态 / 判断可用态。
 * 由 EditorToolbar 遍历渲染，统一样式与交互（active 高亮、disabled 置灰）。
 */
import type { Editor } from "@tiptap/react";
import type { LucideIcon } from "lucide-react";
import {
	AlignCenter,
	AlignJustify,
	AlignLeft,
	AlignRight,
	Bold,
	Code,
	Code2,
	Heading1,
	Heading2,
	Heading3,
	Highlighter,
	Italic,
	Link as LinkIcon,
	List,
	ListOrdered,
	ListTodo,
	Minus,
	Pilcrow,
	Quote,
	Redo2,
	Strikethrough,
	Table as TableIcon,
	Underline,
	Undo2,
} from "lucide-react";

export interface ToolbarItem {
	/** 唯一标识 */
	id: string;
	/** lucide 图标 */
	icon: LucideIcon;
	/** 悬停标题 */
	title: string;
	/** 执行命令 */
	run: (editor: Editor) => void;
	/** 当前是否激活（高亮） */
	isActive: (editor: Editor) => boolean;
	/** 当前是否可用（禁用置灰，如无历史可撤销） */
	canRun?: (editor: Editor) => boolean;
}

/** 分隔符标记，仅作分组视觉用，渲染为竖线 */
export const TOOLBAR_DIVIDER = "__divider__";

/** 历史组 */
export const historyItems: ToolbarItem[] = [
	{
		id: "undo",
		icon: Undo2,
		title: "撤销 (⌘Z)",
		run: (e) => e.chain().focus().undo().run(),
		isActive: () => false,
		canRun: (e) => e.can().undo(),
	},
	{
		id: "redo",
		icon: Redo2,
		title: "重做 (⌘⇧Z)",
		run: (e) => e.chain().focus().redo().run(),
		isActive: () => false,
		canRun: (e) => e.can().redo(),
	},
];

/** 文本格式组 */
export const formatItems: ToolbarItem[] = [
	{
		id: "bold",
		icon: Bold,
		title: "粗体 (⌘B)",
		run: (e) => e.chain().focus().toggleBold().run(),
		isActive: (e) => e.isActive("bold"),
		canRun: (e) => e.can().toggleBold(),
	},
	{
		id: "italic",
		icon: Italic,
		title: "斜体 (⌘I)",
		run: (e) => e.chain().focus().toggleItalic().run(),
		isActive: (e) => e.isActive("italic"),
		canRun: (e) => e.can().toggleItalic(),
	},
	{
		id: "underline",
		icon: Underline,
		title: "下划线 (⌘U)",
		run: (e) => e.chain().focus().toggleUnderline().run(),
		isActive: (e) => e.isActive("underline"),
		canRun: (e) => e.can().toggleUnderline(),
	},
	{
		id: "strike",
		icon: Strikethrough,
		title: "删除线",
		run: (e) => e.chain().focus().toggleStrike().run(),
		isActive: (e) => e.isActive("strike"),
		canRun: (e) => e.can().toggleStrike(),
	},
	{
		id: "code",
		icon: Code,
		title: "行内代码",
		run: (e) => e.chain().focus().toggleCode().run(),
		isActive: (e) => e.isActive("code"),
		canRun: (e) => e.can().toggleCode(),
	},
	{
		id: "highlight",
		icon: Highlighter,
		title: "高亮",
		run: (e) => e.chain().focus().toggleHighlight().run(),
		isActive: (e) => e.isActive("highlight"),
		canRun: (e) => e.can().toggleHighlight(),
	},
];

/** 对齐组 */
export const alignItems: ToolbarItem[] = [
	{
		id: "alignLeft",
		icon: AlignLeft,
		title: "左对齐",
		run: (e) => e.chain().focus().setTextAlign("left").run(),
		isActive: (e) => e.isActive({ textAlign: "left" }),
		canRun: (e) => e.can().setTextAlign("left"),
	},
	{
		id: "alignCenter",
		icon: AlignCenter,
		title: "居中",
		run: (e) => e.chain().focus().setTextAlign("center").run(),
		isActive: (e) => e.isActive({ textAlign: "center" }),
		canRun: (e) => e.can().setTextAlign("center"),
	},
	{
		id: "alignRight",
		icon: AlignRight,
		title: "右对齐",
		run: (e) => e.chain().focus().setTextAlign("right").run(),
		isActive: (e) => e.isActive({ textAlign: "right" }),
		canRun: (e) => e.can().setTextAlign("right"),
	},
	{
		id: "alignJustify",
		icon: AlignJustify,
		title: "两端对齐",
		run: (e) => e.chain().focus().setTextAlign("justify").run(),
		isActive: (e) => e.isActive({ textAlign: "justify" }),
		canRun: (e) => e.can().setTextAlign("justify"),
	},
];

/** 段落 / 标题组 */
export const headingItems: ToolbarItem[] = [
	{
		id: "paragraph",
		icon: Pilcrow,
		title: "正文段落",
		run: (e) => e.chain().focus().setParagraph().run(),
		isActive: (e) => e.isActive("paragraph"),
		canRun: (e) => e.can().setParagraph(),
	},
	{
		id: "h1",
		icon: Heading1,
		title: "一级标题",
		run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
		isActive: (e) => e.isActive("heading", { level: 1 }),
		canRun: (e) => e.can().toggleHeading({ level: 1 }),
	},
	{
		id: "h2",
		icon: Heading2,
		title: "二级标题",
		run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
		isActive: (e) => e.isActive("heading", { level: 2 }),
		canRun: (e) => e.can().toggleHeading({ level: 2 }),
	},
	{
		id: "h3",
		icon: Heading3,
		title: "三级标题",
		run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
		isActive: (e) => e.isActive("heading", { level: 3 }),
		canRun: (e) => e.can().toggleHeading({ level: 3 }),
	},
];

/** 列表 / 块组 */
export const blockItems: ToolbarItem[] = [
	{
		id: "bulletList",
		icon: List,
		title: "无序列表",
		run: (e) => e.chain().focus().toggleBulletList().run(),
		isActive: (e) => e.isActive("bulletList"),
		canRun: (e) => e.can().toggleBulletList(),
	},
	{
		id: "orderedList",
		icon: ListOrdered,
		title: "有序列表",
		run: (e) => e.chain().focus().toggleOrderedList().run(),
		isActive: (e) => e.isActive("orderedList"),
		canRun: (e) => e.can().toggleOrderedList(),
	},
	{
		id: "taskList",
		icon: ListTodo,
		title: "任务列表",
		run: (e) => e.chain().focus().toggleTaskList().run(),
		isActive: (e) => e.isActive("taskList"),
		canRun: (e) => e.can().toggleTaskList(),
	},
	{
		id: "blockquote",
		icon: Quote,
		title: "引用",
		run: (e) => e.chain().focus().toggleBlockquote().run(),
		isActive: (e) => e.isActive("blockquote"),
		canRun: (e) => e.can().toggleBlockquote(),
	},
	{
		id: "codeBlock",
		icon: Code2,
		title: "代码块",
		run: (e) => e.chain().focus().toggleCodeBlock().run(),
		isActive: (e) => e.isActive("codeBlock"),
		canRun: (e) => e.can().toggleCodeBlock(),
	},
	{
		id: "hr",
		icon: Minus,
		title: "分割线",
		run: (e) => e.chain().focus().setHorizontalRule().run(),
		isActive: () => false,
		canRun: (e) => e.can().setHorizontalRule(),
	},
	{
		id: "table",
		icon: TableIcon,
		title: "插入表格",
		run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
		isActive: () => false,
	},
];

/**
 * buildToolbarItems - 构造工具栏项（注入链接插入回调）
 *
 * @param onInsertLink 点击「插入链接」时的回调（由父组件打开输入弹窗）
 */
export function buildToolbarItems(
	onInsertLink: () => void,
): Array<ToolbarItem | typeof TOOLBAR_DIVIDER> {
	const linkItem: ToolbarItem = {
		id: "link",
		icon: LinkIcon,
		title: "插入链接",
		run: () => onInsertLink(),
		isActive: (e) => e.isActive("link"),
	};
	return [
		...historyItems,
		TOOLBAR_DIVIDER,
		...headingItems,
		TOOLBAR_DIVIDER,
		...formatItems,
		TOOLBAR_DIVIDER,
		...alignItems,
		TOOLBAR_DIVIDER,
		...blockItems,
		linkItem,
	];
}
