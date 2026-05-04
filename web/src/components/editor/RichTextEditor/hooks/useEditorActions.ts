/**
 * 编辑器操作 Hook
 */

import { useCallback } from "react";
import type { Editor } from "@tiptap/react";

interface UseEditorActionsOptions {
  /** 编辑器实例 */
  editor: Editor | null;
}

/**
 * 编辑器操作 Hook
 * 封装常用的编辑器操作
 */
export function useEditorActions({ editor }: UseEditorActionsOptions) {
  /**
   * 插入链接
   */
  const insertLink = useCallback(
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
    [editor]
  );

  /**
   * 移除链接
   */
  const unsetLink = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().unsetLink().run();
  }, [editor]);

  /**
   * 插入图片
   */
  const insertImage = useCallback(
    (src: string, alt?: string) => {
      if (!editor) return;
      editor
        .chain()
        .focus()
        .setImage({ src, alt: alt ?? "" })
        .run();
    },
    [editor]
  );

  /**
   * 插入分割线（使用 hr 标签）
   */
  const insertHorizontalRule = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertContent("<hr>").run();
  }, [editor]);

  return {
    insertLink,
    unsetLink,
    insertImage,
    insertHorizontalRule,
  };
}
