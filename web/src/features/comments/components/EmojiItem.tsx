/**
 * 单个表情项组件
 * 支持图片和文本两种显示方式
 */

import { cn } from "@/lib/utils";
import { getUploadUrl } from "@/lib/api";
import type { Emoji } from "@/types/emoji";

interface EmojiItemProps {
  emoji: Emoji;
  onClick: () => void;
  className?: string;
}

/**
 * 单个表情项
 */
export function EmojiItem({ emoji, onClick, className }: EmojiItemProps) {
  // 判断显示内容
  // 颜文字：text_content 有值，直接显示文本（不拼接域名）
  // 图片表情：url 有值，需要拼接域名
  const isImage = emoji.url && emoji.url !== emoji.text_content;
  const display = isImage
    ? getUploadUrl(emoji.url!)
    : emoji.text_content || emoji.name;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center",
        "w-11 h-11 rounded-md",
        "bg-transparent hover:bg-accent/80",
        "transition-all duration-100 cursor-pointer",
        "focus:outline-none focus:ring-2 focus:ring-ring/50",
        "hover:scale-110 active:scale-95",
        className
      )}
      title={emoji.name}
      aria-label={`插入表情 ${emoji.name}`}
    >
      {isImage ? (
        <img
          src={display}
          alt={emoji.name}
          className="w-8 h-8 rounded object-contain pointer-events-none select-none"
          loading="lazy"
          onError={(e) => {
            const target = e.currentTarget;
            target.style.display = "none";
            const fallback = document.createElement("span");
            fallback.textContent = emoji.text_content || emoji.name;
            fallback.className = "text-lg text-muted-foreground";
            target.parentElement?.appendChild(fallback);
          }}
        />
      ) : (
        <span className="text-2xl text-center leading-none select-none">
          {display}
        </span>
      )}
    </button>
  );
}