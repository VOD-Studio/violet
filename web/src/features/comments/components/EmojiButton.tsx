import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Smile } from "lucide-react";
import { cn } from "@/lib/utils";
import { getUploadUrl } from "@/lib/api";
import { EmojiPanel } from "./EmojiPanel";
import { useEmojis } from "@/hooks/useEmojis";
import type { Emoji } from "@/types/emoji";

interface EmojiButtonProps {
  /** 选择表情回调 */
  onSelect: (emojiName: string, emojiDisplay: string) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义按钮样式 */
  className?: string;
  /** 是否自动关闭 */
  autoClose?: boolean;
}

/**
 * 表情按钮
 */
export function EmojiButton({
  onSelect,
  disabled = false,
  className,
  autoClose,
}: EmojiButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { groups, loading, error } = useEmojis();
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const [isPositioned, setIsPositioned] = useState(false);

  // 计算面板位置
  const calculatePosition = useCallback(() => {
    if (!buttonRef.current) return { left: 0, top: 0 };

    const buttonRect = buttonRef.current.getBoundingClientRect();
    const panelWidth = 360;
    const panelHeight = 420;
    const gap = 8;

    let left = buttonRect.left;
    let top = buttonRect.bottom + gap;

    if (left + panelWidth > window.innerWidth) {
      left = window.innerWidth - panelWidth - 16;
    }
    if (left < 16) left = 16;

    if (top + panelHeight > window.innerHeight) {
      const topPosition = buttonRect.top - panelHeight - gap;
      if (topPosition > 16) {
        top = topPosition;
      } else {
        top = Math.max(16, window.innerHeight - panelHeight - 16);
      }
    }

    return { left, top };
  }, []);

  useEffect(() => {
    if (isOpen) {
      const pos = calculatePosition();
      setPosition(pos);
      requestAnimationFrame(() => setIsPositioned(true));
    } else {
      setIsPositioned(false);
    }
  }, [isOpen, calculatePosition]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  const handleSelect = (emoji: Emoji) => {
    // 判断是否是颜文字（url 不是真正的 URL）
    const isTextEmoji = !emoji.url?.startsWith('http') && !emoji.url?.startsWith('/');

    // 图片表情：使用 [name] 格式
    // 颜文字：直接插入文本，不需要方括号
    const emojiName = isTextEmoji
      ? emoji.url || emoji.name  // 颜文字直接插入文本
      : emoji.name;              // 图片表情保持原格式（已有方括号）

    const emojiDisplay = isTextEmoji
      ? emoji.url || emoji.name  // 颜文字显示文本
      : getUploadUrl(emoji.url); // 图片表情显示 URL

    onSelect(emojiName, emojiDisplay);
    autoClose && setIsOpen(false);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "w-8 h-8 rounded flex items-center justify-center",
          "hover:bg-primary/10 hover:text-primary",
          "transition-colors",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
        title="选择表情"
        aria-label="选择表情"
        aria-expanded={isOpen}
      >
        <Smile className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {isOpen && isPositioned && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed z-50"
            style={{ left: `${position.left}px`, top: `${position.top}px` }}
          >
            <EmojiPanel
              groups={groups}
              loading={loading}
              error={error}
              onSelect={handleSelect}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
