// Markdown 内容预览组件
// 将 HTML 内容渲染为预览视图，支持代码高亮

import { useEffect, useRef } from "react";
import { common, createLowlight } from "lowlight";
import { toHtml } from "hast-util-to-html";

/** 创建 lowlight 实例 */
const lowlight = createLowlight(common);

/** 预览组件属性 */
interface MarkdownPreviewProps {
  /** HTML 内容 */
  content: string;
  /** 自定义类名 */
  className?: string;
}

/**
 * Markdown 预览组件
 * 渲染 HTML 内容并对代码块进行语法高亮
 */
export default function MarkdownPreview({
  content,
  className = "",
}: MarkdownPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // 对代码块进行语法高亮
    const codeBlocks = containerRef.current.querySelectorAll("pre code");
    for (const block of codeBlocks) {
      const classList = Array.from(block.classList);
      const langClass = classList.find((c) => c.startsWith("language-"));
      const lang = langClass?.replace("language-", "");

      if (lang && lowlight.registered(lang)) {
        const result = lowlight.highlight(lang, block.textContent ?? "");
        block.innerHTML = toHtml(result);
      }
    }
  }, [content]);

  return (
    <div
      ref={containerRef}
      className={`prose prose-sm sm:prose-base max-w-none dark:prose-invert ${className}`}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
