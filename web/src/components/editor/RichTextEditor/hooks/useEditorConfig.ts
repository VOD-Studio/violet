/**
 * 编辑器配置 Hook
 */

import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";

/** 创建 lowlight 实例 */
const lowlight = createLowlight(common);

interface UseEditorConfigOptions {
  /** 初始内容 */
  content: string;
  /** 占位文本 */
  placeholder: string;
  /** 内容变化回调 */
  onUpdate?: (html: string, charCount: number) => void;
}

/**
 * 编辑器配置 Hook
 */
export function useEditorConfig({
  content,
  placeholder,
  onUpdate,
}: UseEditorConfigOptions) {
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
      // 统计纯文本字数
      const text = ed.getText();
      const charCount = text.replace(/\s/g, "").length;
      onUpdate?.(html, charCount);
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[400px] p-4",
      },
    },
  });

  return editor;
}
