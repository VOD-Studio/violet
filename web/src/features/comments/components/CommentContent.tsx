/**
 * 评论内容渲染组件
 * 将 HTML 中的表情语法 [emoji_name] 转换为表情显示
 */

import { useMemo } from "react";
import { useEmojis } from "@/hooks/useEmojis";
import { getUploadUrl } from "@/lib/api";

interface CommentContentProps {
  /** HTML 内容 */
  html: string;
  /** 自定义样式 */
  className?: string;
}

/**
 * 评论内容组件
 * 解析 HTML 中的表情语法并渲染为图片或 emoji
 */
export function CommentContent({ html, className }: CommentContentProps) {
  const { getDisplayByName } = useEmojis();

  const renderedContent = useMemo(() => {
    // 匹配 [emoji_name] 语法（包括被 HTML 标签包裹的情况）
    const emojiRegex = /\[([^\]]+)\]/g;

    // 替换表情语法为实际的表情元素
    const processedHtml = html.replace(emojiRegex, (match, emojiName) => {
      const display = getDisplayByName(emojiName);

      if (!display) {
        // 表情不存在，保留原文
        return match;
      }

      // 判断是图片还是文本
      if (display.startsWith("http") || display.startsWith("/")) {
        const imageUrl = display.startsWith("/") ? getUploadUrl(display) : display;
        return `<img src="${imageUrl}" alt="${emojiName}" class="inline-block w-5 h-5 align-text-bottom mx-0.5" style="display: inline-block;" />`;
      } else {
        return `<span class="inline-block mx-0.5" style="display: inline-block;">${display}</span>`;
      }
    });

    return processedHtml;
  }, [html, getDisplayByName]);

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: renderedContent }}
    />
  );
}
