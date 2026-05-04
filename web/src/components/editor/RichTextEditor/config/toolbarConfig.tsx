/**
 * 工具栏按钮配置
 */

import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image as ImageIcon,
  Code,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Highlighter,
  Undo2,
  Redo2,
  Minus,
} from "lucide-react";
import type { Editor } from "@tiptap/react";

export interface ToolbarButtonConfig {
  /** 按钮图标 */
  icon: React.ComponentType<{ className?: string }>;
  /** 提示文本 */
  title: string;
  /** 点击事件 */
  onClick: (editor: Editor) => void;
  /** 是否激活 */
  isActive?: (editor: Editor) => boolean;
  /** 是否禁用 */
  isDisabled?: (editor: Editor) => boolean;
}

export interface ToolbarGroup {
  /** 分组名称 */
  name: string;
  /** 按钮列表 */
  buttons: ToolbarButtonConfig[];
}

/**
 * 获取工具栏配置
 */
export function getToolbarConfig(
  openLinkDialog: () => void,
  openImageDialog: () => void,
  _unsetLink: () => void,
  insertHorizontalRule: () => void
): ToolbarGroup[] {
  return [
    {
      name: "history",
      buttons: [
        {
          icon: Undo2,
          title: "撤销 (Ctrl+Z)",
          onClick: (editor) => editor.chain().focus().undo().run(),
          isDisabled: (editor) => !editor.can().undo(),
        },
        {
          icon: Redo2,
          title: "重做 (Ctrl+Shift+Z)",
          onClick: (editor) => editor.chain().focus().redo().run(),
          isDisabled: (editor) => !editor.can().redo(),
        },
      ],
    },
    {
      name: "headings",
      buttons: [
        {
          icon: Heading1,
          title: "一级标题 (#)",
          onClick: (editor) =>
            editor.chain().focus().toggleHeading({ level: 1 }).run(),
          isActive: (editor) => editor.isActive("heading", { level: 1 }),
        },
        {
          icon: Heading2,
          title: "二级标题 (##)",
          onClick: (editor) =>
            editor.chain().focus().toggleHeading({ level: 2 }).run(),
          isActive: (editor) => editor.isActive("heading", { level: 2 }),
        },
        {
          icon: Heading3,
          title: "三级标题 (###)",
          onClick: (editor) =>
            editor.chain().focus().toggleHeading({ level: 3 }).run(),
          isActive: (editor) => editor.isActive("heading", { level: 3 }),
        },
      ],
    },
    {
      name: "formatting",
      buttons: [
        {
          icon: Bold,
          title: "粗体 (Ctrl+B)",
          onClick: (editor) => editor.chain().focus().toggleBold().run(),
          isActive: (editor) => editor.isActive("bold"),
        },
        {
          icon: Italic,
          title: "斜体 (Ctrl+I)",
          onClick: (editor) => editor.chain().focus().toggleItalic().run(),
          isActive: (editor) => editor.isActive("italic"),
        },
        {
          icon: UnderlineIcon,
          title: "下划线 (Ctrl+U)",
          onClick: (editor) => editor.chain().focus().toggleUnderline().run(),
          isActive: (editor) => editor.isActive("underline"),
        },
        {
          icon: Strikethrough,
          title: "删除线",
          onClick: (editor) => editor.chain().focus().toggleStrike().run(),
          isActive: (editor) => editor.isActive("strike"),
        },
        {
          icon: Highlighter,
          title: "高亮",
          onClick: (editor) => editor.chain().focus().toggleHighlight().run(),
          isActive: (editor) => editor.isActive("highlight"),
        },
      ],
    },
    {
      name: "lists",
      buttons: [
        {
          icon: List,
          title: "无序列表 (-)",
          onClick: (editor) => editor.chain().focus().toggleBulletList().run(),
          isActive: (editor) => editor.isActive("bulletList"),
        },
        {
          icon: ListOrdered,
          title: "有序列表 (1.)",
          onClick: (editor) =>
            editor.chain().focus().toggleOrderedList().run(),
          isActive: (editor) => editor.isActive("orderedList"),
        },
      ],
    },
    {
      name: "blocks",
      buttons: [
        {
          icon: Quote,
          title: "引用 (>)",
          onClick: (editor) => editor.chain().focus().toggleBlockquote().run(),
          isActive: (editor) => editor.isActive("blockquote"),
        },
        {
          icon: Code,
          title: "代码块 (```)",
          onClick: (editor) => editor.chain().focus().toggleCodeBlock().run(),
          isActive: (editor) => editor.isActive("codeBlock"),
        },
      ],
    },
    {
      name: "alignment",
      buttons: [
        {
          icon: AlignLeft,
          title: "左对齐",
          onClick: (editor) => editor.chain().focus().setTextAlign("left").run(),
          isActive: (editor) => editor.isActive({ textAlign: "left" }),
        },
        {
          icon: AlignCenter,
          title: "居中对齐",
          onClick: (editor) =>
            editor.chain().focus().setTextAlign("center").run(),
          isActive: (editor) => editor.isActive({ textAlign: "center" }),
        },
        {
          icon: AlignRight,
          title: "右对齐",
          onClick: (editor) =>
            editor.chain().focus().setTextAlign("right").run(),
          isActive: (editor) => editor.isActive({ textAlign: "right" }),
        },
      ],
    },
    {
      name: "divider",
      buttons: [
        {
          icon: Minus,
          title: "分割线 (---)",
          onClick: () => insertHorizontalRule(),
        },
      ],
    },
    {
      name: "media",
      buttons: [
        {
          icon: LinkIcon,
          title: "插入链接",
          onClick: () => openLinkDialog(),
          isActive: (editor) => editor.isActive("link"),
        },
        {
          icon: ImageIcon,
          title: "插入图片（支持素材库）",
          onClick: () => openImageDialog(),
        },
      ],
    },
  ];
}
