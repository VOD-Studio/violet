/**
 * 表情按钮组件
 * 带 motion 动画的表情选择器触发按钮
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Smile } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmojiPanel } from "./EmojiPanel";
import { useEmojis } from "@/hooks/useEmojis";

interface EmojiButtonProps {
  /** 选择表情回调 */
  onSelect: (emojiName: string, emojiDisplay: string) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义按钮样式 */
  className?: string;
}

/**
 * 表情按钮
 * 点击弹出表情选择面板，带流畅动画
 */
export function EmojiButton({
  onSelect,
  disabled = false,
  className,
}: EmojiButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { groups, loading, error, search } = useEmojis();
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const [isPositioned, setIsPositioned] = useState(false);

  // 计算面板位置（带边界检测）
  const calculatePosition = useCallback(() => {
    if (!buttonRef.current) return { left: 0, top: 0 };

    const buttonRect = buttonRef.current.getBoundingClientRect();
    const panelWidth = 360; // EmojiPanel 宽度
    const panelHeight = 420; // EmojiPanel 最大高度
    const gap = 8;

    let left = buttonRect.left;
    let top = buttonRect.bottom + gap;

    // 右边界检测
    if (left + panelWidth > window.innerWidth) {
      left = window.innerWidth - panelWidth - 16; // 留 16px 边距
    }

    // 左边界检测
    if (left < 16) {
      left = 16;
    }

    // 底部边界检测
    if (top + panelHeight > window.innerHeight) {
      // 尝试显示在按钮上方
      const topPosition = buttonRect.top - panelHeight - gap;
      if (topPosition > 16) {
        top = topPosition;
      } else {
        // 上下都放不下，显示在视口内
        top = Math.max(16, window.innerHeight - panelHeight - 16);
      }
    }

    return { left, top };
  }, []);

  // 更新位置
  useEffect(() => {
    if (isOpen) {
      // 立即计算位置，避免闪烁
      const pos = calculatePosition();
      setPosition(pos);
      // 下一帧显示面板
      requestAnimationFrame(() => {
        setIsPositioned(true);
      });
    } else {
      setIsPositioned(false);
    }
  }, [isOpen, calculatePosition]);

  // 点击外部关闭
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

  // ESC 关闭
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  const handleSelect = (emojiName: string, emojiDisplay: string) => {
    onSelect(emojiName, emojiDisplay);
    setIsOpen(false);
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
            transition={{
              duration: 0.15,
              ease: "easeOut",
            }}
            className="fixed z-50"
            style={{
              left: `${position.left}px`,
              top: `${position.top}px`,
            }}
          >
            <EmojiPanel
              groups={groups}
              loading={loading}
              error={error}
              onSearch={search}
              onSelect={handleSelect}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
