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
 * 图片表情：url 是真正的 URL（以 http/https/ 开头）
 * 颜文字：url 存的是表情文本本身
 */
export function EmojiItem({ emoji, onClick, className }: EmojiItemProps) {
  // 判断是否是真正的图片 URL
  const isImageUrl = emoji.url?.startsWith('http') || emoji.url?.startsWith('/');
  const display = isImageUrl
    ? getUploadUrl(emoji.gif_url || emoji.url!)
    : emoji.url || emoji.text_content || emoji.name;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center rounded-md",
        "bg-transparent hover:bg-accent/80",
        "transition-colors cursor-pointer",
        "hover:scale-110 active:scale-95",
        isImageUrl ? "w-11 h-11" : "h-11 px-3",
        className
      )}
      title={emoji.name}
    >
      {isImageUrl ? (
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
