/**
 * 富文本编辑器组件
 * 基于 Tiptap 实现，支持格式化工具栏、图片/视频插入、字数统计
 * 工具栏在长内容时固定到视口顶部
 */

import { EditorContent } from "@tiptap/react";
import { useCallback, useEffect, useState, useRef } from "react";
import { LinkDialog, ImageDialog } from "../EditorDialogs";
import { useEditorConfig } from "./hooks/useEditorConfig";
import { useEditorActions } from "./hooks/useEditorActions";
import { useStickyToolbar } from "./hooks/useStickyToolbar";
import { EditorToolbar } from "./components/EditorToolbar";
import { EditorStatusBar } from "./components/EditorStatusBar";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // 编辑器配置
  const editor = useEditorConfig({
    content,
    placeholder,
    onUpdate: (html, count) => {
      onChange?.(html);
      setCharCount(count);
    },
  });

  // 编辑器操作
  const { insertLink, unsetLink, insertImage, insertHorizontalRule } =
    useEditorActions({ editor });

  // 工具栏固定逻辑
  const toolbarSticky = useStickyToolbar({ containerRef, toolbarRef });

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
   * 打开图片对话框
   */
  const openImageDialog = useCallback(() => {
    setImageDialogOpen(true);
  }, []);

  /**
   * 处理插入链接
   */
  const handleInsertLink = useCallback(
    (url: string, text?: string) => {
      insertLink(url, text);
    },
    [insertLink]
  );

  /**
   * 处理插入图片
   */
  const handleInsertImage = useCallback(
    (src: string, alt?: string) => {
      insertImage(src, alt);
    },
    [insertImage]
  );

  if (!editor) return null;

  return (
    <div
      ref={containerRef}
      className={`rounded-lg border bg-background ${className}`}
    >
      {/* 工具栏 - 滚动时固定到视口顶部 */}
      <EditorToolbar
        editor={editor}
        isSticky={toolbarSticky}
        toolbarRef={toolbarRef}
        onOpenLinkDialog={openLinkDialog}
        onOpenImageDialog={openImageDialog}
        onUnsetLink={unsetLink}
        onInsertHorizontalRule={insertHorizontalRule}
      />

      {/* 编辑区域 */}
      <EditorContent editor={editor} />

      {/* 底部状态栏 */}
      <EditorStatusBar charCount={charCount} />

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
