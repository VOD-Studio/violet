/**
 * 单个表情项组件
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
 * 图片表情：固定 44x44px，grid 布局
 * 颜文字：自适应宽度，flex 布局
 */
export function EmojiItem({ emoji, onClick, className }: EmojiItemProps) {
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
        "transition-colors cursor-pointer",
        "hover:scale-110 active:scale-95",
        isImage ? "w-11 h-11" : "h-11 px-3", // 颜文字自适应宽度
        className
      )}
      title={emoji.name}
    >
      {isImage ? (
        <img
          src={display}
          alt={emoji.name}
          className="w-8 h-8 object-contain"
          loading="lazy"
        />
      ) : (
        <span className="text-lg leading-tight whitespace-pre">{display}</span>
      )}
    </button>
  );
}
