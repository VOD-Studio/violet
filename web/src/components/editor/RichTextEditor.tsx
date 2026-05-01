// 富文本编辑器组件
// 基于 Tiptap 实现，支持格式化工具栏、图片/视频插入、字数统计
// 工具栏在长内容时固定到视口顶部

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { useCallback, useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
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
import { LinkDialog, ImageDialog } from "./EditorDialogs";

/** 创建 lowlight 实例 */
const lowlight = createLowlight(common);

/** 编辑器组件属性 */
interface RichTextEditorProps {
  /** 初始内容（HTML） */
  content?: string;
  /** 内容变化回调 */
  onChange?: (html: string) => void;
  /** 占位文本 */
  placeholder?: string;
  /** 自定义类名 */
  className?: string;
}

/**
 * 工具栏按钮组件
 */
function ToolbarButton({
  onClick,
  isActive = false,
  disabled = false,
  title,
  children,
}: {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={isActive ? "secondary" : "ghost"}
      size="icon-sm"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="h-8 w-8"
    >
      {children}
    </Button>
  );
}

/**
 * 工具栏分隔线
 */
function ToolbarDivider() {
  return <div className="mx-1 h-6 w-px bg-border" />;
}

/**
 * 富文本编辑器
 * 提供完整的格式化工具栏和内容编辑能力
 */
export default function RichTextEditor({
  content = "",
  onChange,
  placeholder = "请输入文章内容...",
  className = "",
}: RichTextEditorProps) {
  const [charCount, setCharCount] = useState(0);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [toolbarSticky, setToolbarSticky] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        link: false,
      }),
      Image.configure({
        HTMLAttributes: {
          class: "max-w-full rounded-lg",
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline-offset-4 hover:underline",
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Underline,
      Highlight.configure({
        multicolor: false,
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }),
    ],
    content,
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      onChange?.(html);
      // 统计纯文本字数
      const text = ed.getText();
      setCharCount(text.replace(/\s/g, "").length);
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[400px] p-4",
      },
    },
  });

  // 监听滚动，当工具栏滚出容器时固定到视口顶部
  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current || !toolbarRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const toolbarHeight = toolbarRef.current.offsetHeight;

      // 当容器顶部离开视口时，工具栏需要固定
      if (containerRect.top < -toolbarHeight) {
        setToolbarSticky(true);
      } else {
        setToolbarSticky(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // 初始化字数统计
  useEffect(() => {
    if (editor && content) {
      const text = editor.getText();
      setCharCount(text.replace(/\s/g, "").length);
    }
  }, [editor, content]);

  // 同步外部传入的内容变化（如 API 加载后的回填）
  useEffect(() => {
    if (editor && content && editor.getHTML() !== content) {
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  /**
   * 打开链接对话框
   */
  const openLinkDialog = useCallback(() => {
    if (!editor) return;
    setLinkDialogOpen(true);
  }, [editor]);

  /**
   * 插入链接
   */
  const handleInsertLink = useCallback(
    (url: string, text?: string) => {
      if (!editor) return;

      // 如果有选中文本且有传入 text，先替换选中文本
      if (text) {
        editor.chain().focus().insertContent(text).run();
      }

      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url })
        .run();
    },
    [editor],
  );

  /**
   * 移除链接
   */
  const unsetLink = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().unsetLink().run();
  }, [editor]);

  /**
   * 打开图片对话框
   */
  const openImageDialog = useCallback(() => {
    setImageDialogOpen(true);
  }, []);

  /**
   * 插入图片
   */
  const handleInsertImage = useCallback(
    (src: string, alt?: string) => {
      if (!editor) return;
      editor
        .chain()
        .focus()
        .setImage({ src, alt: alt ?? "" })
        .run();
    },
    [editor],
  );

  /**
   * 插入分割线（使用 hr 标签）
   */
  const insertHorizontalRule = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertContent("<hr>").run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div
      ref={containerRef}
      className={`rounded-lg border bg-background ${className}`}
    >
      {/* 工具栏 - 滚动时固定到视口顶部 */}
      <div
        ref={toolbarRef}
        className={`flex flex-wrap items-center gap-0.5 border-b bg-muted/30 p-2 backdrop-blur-sm transition-shadow ${
          toolbarSticky
            ? "fixed top-0 left-0 right-0 z-50 shadow-md rounded-none"
            : ""
        }`}
      >
        {/* 撤销/重做 */}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="撤销 (Ctrl+Z)"
        >
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="重做 (Ctrl+Shift+Z)"
        >
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* 标题 */}
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          isActive={editor.isActive("heading", { level: 1 })}
          title="一级标题 (#)"
        >
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          isActive={editor.isActive("heading", { level: 2 })}
          title="二级标题 (##)"
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          isActive={editor.isActive("heading", { level: 3 })}
          title="三级标题 (###)"
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* 文本格式 */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          title="粗体 (Ctrl+B)"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
          title="斜体 (Ctrl+I)"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive("underline")}
          title="下划线 (Ctrl+U)"
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive("strike")}
          title="删除线"
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          isActive={editor.isActive("highlight")}
          title="高亮"
        >
          <Highlighter className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* 列表 */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive("bulletList")}
          title="无序列表 (-)"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive("orderedList")}
          title="有序列表 (1.)"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* 引用和代码 */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive("blockquote")}
          title="引用 (>)"
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          isActive={editor.isActive("codeBlock")}
          title="代码块 (```)"
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* 对齐 */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          isActive={editor.isActive({ textAlign: "left" })}
          title="左对齐"
        >
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          isActive={editor.isActive({ textAlign: "center" })}
          title="居中对齐"
        >
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          isActive={editor.isActive({ textAlign: "right" })}
          title="右对齐"
        >
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* 分割线 */}
        <ToolbarButton onClick={insertHorizontalRule} title="分割线 (---)">
          <Minus className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* 插入链接和图片 */}
        <ToolbarButton
          onClick={openLinkDialog}
          isActive={editor.isActive("link")}
          title="插入链接"
        >
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
        {editor.isActive("link") && (
          <ToolbarButton onClick={unsetLink} title="移除链接">
            <LinkIcon className="h-4 w-4 text-destructive" />
          </ToolbarButton>
        )}
        <ToolbarButton onClick={openImageDialog} title="插入图片（支持素材库）">
          <ImageIcon className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {/* 编辑区域 */}
      <EditorContent editor={editor} />

      {/* 底部状态栏 */}
      <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-1.5 text-xs text-muted-foreground">
        <span>字数: {charCount}</span>
        <span>支持 Markdown 快捷键</span>
      </div>

      {/* 链接对话框 */}
      <LinkDialog
        open={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        onInsert={handleInsertLink}
        initialUrl={editor.getAttributes("link").href}
      />

      {/* 图片对话框 */}
      <ImageDialog
        open={imageDialogOpen}
        onClose={() => setImageDialogOpen(false)}
        onInsert={handleInsertImage}
      />
    </div>
  );
}
