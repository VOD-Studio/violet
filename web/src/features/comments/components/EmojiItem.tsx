/**
 * 单个表情项组件
 * 支持图片和文本两种显示方式，带轻量动画
 */

import { cn } from "@/lib/utils";

interface EmojiItemProps {
  /** 表情 ID */
  id: number;
  /** 表情名称 */
  name: string;
  /** 显示内容（图片 URL 或文本） */
  display: string;
  /** 是否为图片 */
  isImage: boolean;
  /** 点击回调 */
  onClick: () => void;
  /** 自定义样式 */
  className?: string;
}

/**
 * 单个表情项
 * 使用 CSS 实现轻量动画
 */
export function EmojiItem({
  name,
  display,
  isImage,
  onClick,
  className,
}: EmojiItemProps) {
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
      title={name}
      aria-label={`插入表情 ${name}`}
    >
      {isImage ? (
        <img
          src={display}
          alt={name}
          className="w-8 h-8 rounded object-contain pointer-events-none select-none"
          loading="lazy"
          onError={(e) => {
            const target = e.currentTarget;
            target.style.display = "none";
            const fallback = document.createElement("span");
            fallback.textContent = name.charAt(0);
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
