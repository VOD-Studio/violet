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
 * 图片表情：固定尺寸 44x44px
 * 颜文字：自适应宽度，更大字体
 */
export function EmojiItem({ emoji, onClick, className }: EmojiItemProps) {
  // 判断显示内容
  // 颜文字：text_content 有值且没有 url（或 url 等于 text_content）
  // 图片表情：url 有值且是真正的 URL
  const isImage = emoji.url && !emoji.text_content;
  const display = isImage
    ? getUploadUrl(emoji.gif_url || emoji.url)
    : emoji.text_content || emoji.name;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center rounded-md",
        "bg-transparent hover:bg-accent/80",
        "transition-all duration-100 cursor-pointer",
        "focus:outline-none focus:ring-2 focus:ring-ring/50",
        "hover:scale-110 active:scale-95",
        isImage ? "w-11 h-11" : "min-w-11 h-11 px-2", // 颜文字自适应宽度
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
        <span className="text-lg text-center leading-tight select-none whitespace-pre">
          {display}
        </span>
      )}
    </button>
  );
}
