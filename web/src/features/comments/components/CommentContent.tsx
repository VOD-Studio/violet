/**
 * 评论内容渲染组件
 * 将评论内容中的表情语法 [emoji_name] 转换为表情显示，并展示图片
 */

import { useMemo, useState } from "react";
import { getUploadUrl } from "@/lib/api";
import type { CommentContent as CommentContentType } from "../types";

interface CommentContentProps {
  /** 评论内容对象 */
  content: CommentContentType;
  /** 自定义样式 */
  className?: string;
}

/**
 * 评论内容组件
 * 使用后端提供的 emote 映射表渲染表情，并展示图片
 */
export function CommentContent({ content, className }: CommentContentProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const renderedContent = useMemo(() => {
    const { message, emote } = content;

    // 匹配 [emoji_name] 语法
    const emojiRegex = /\[([^\]]+)\]/g;

    // 替换表情语法为实际的表情元素
    const processedHtml = message.replace(emojiRegex, (match, emojiName) => {
      const emojiKey = `[${emojiName}]`;
      const emojiInfo = emote[emojiKey];

      if (!emojiInfo) {
        // 表情不存在，保留原文
        return match;
      }

      // 使用后端提供的表情 URL
      if (emojiInfo.url) {
        const imageUrl = emojiInfo.url.startsWith("/")
          ? getUploadUrl(emojiInfo.url)
          : emojiInfo.url;
        return `<img src="${imageUrl}" alt="${emojiName}" class="inline-block w-5 h-5 align-text-bottom mx-0.5" style="display: inline-block;" />`;
      } else {
        // 如果没有 URL，保留原文
        return match;
      }
    });

    return processedHtml;
  }, [content]);

  return (
    <>
      <div
        className={className}
        dangerouslySetInnerHTML={{ __html: renderedContent }}
      />

      {/* 评论图片 */}
      {content.pictures && content.pictures.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {content.pictures.map((picture, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setSelectedImage(picture.url)}
              className="relative rounded overflow-hidden border border-border hover:opacity-90 transition-opacity"
            >
              <img
                src={picture.url}
                alt=""
                className="max-w-40 max-h-40 object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* 图片预览弹窗 */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <img
            src={selectedImage}
            alt=""
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
