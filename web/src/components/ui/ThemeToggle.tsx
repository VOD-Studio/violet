/**
 * 主题切换按钮组件
 * 点击在 light/dark 之间切换，长按弹出三选项菜单（light/dark/system）
 * 使用 motion 实现图标切换动画
 */

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

/** 长按触发时间阈值（毫秒） */
const LONG_PRESS_DURATION = 500;

/** 主题选项配置 */
const THEME_OPTIONS = [
  { value: "light" as const, label: "浅色", icon: Sun },
  { value: "dark" as const, label: "深色", icon: Moon },
  { value: "system" as const, label: "跟随系统", icon: Monitor },
];

/**
 * 主题切换按钮
 * 点击切换 light/dark，长按弹出完整选项菜单
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();

  /** 是否显示长按菜单 */
  const [menuOpen, setMenuOpen] = useState(false);

  /** 长按计时器引用 */
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 是否正在进行长按检测 */
  const isLongPress = useRef(false);

  /** 鼠标/触摸按下时开始长按计时 */
  const handlePointerDown = useCallback(() => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setMenuOpen(true);
    }, LONG_PRESS_DURATION);
  }, []);

  /** 松开时清除计时器，如果不是长按则执行切换 */
  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!isLongPress.current) {
      toggleTheme();
    }
  }, [toggleTheme]);

  /** 指针离开按钮区域时取消长按 */
  const handlePointerLeave = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  /** 从菜单选择主题 */
  const handleSelect = useCallback(
    (value: "light" | "dark" | "system") => {
      setTheme(value);
      setMenuOpen(false);
    },
    [setTheme],
  );

  /** 当前显示的图标组件 */
  const CurrentIcon = resolvedTheme === "dark" ? Moon : Sun;

  return (
    <div className={cn("relative", className)}>
      {/* 主题切换按钮 */}
      <Button
        variant="ghost"
        size="icon"
        aria-label={`当前主题：${theme === "system" ? "跟随系统" : theme === "dark" ? "深色" : "浅色"}，点击切换`}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        className="relative overflow-hidden"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={resolvedTheme}
            initial={{ rotate: -90, scale: 0, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: 90, scale: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="flex items-center justify-center"
          >
            <CurrentIcon className="size-4" />
          </motion.span>
        </AnimatePresence>
      </Button>

      {/* 长按弹出的主题选项菜单 */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* 透明遮罩层，点击关闭菜单 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setMenuOpen(false)}
            />

            {/* 菜单面板 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -4 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute right-0 top-full z-50 mt-1 min-w-[140px] rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
            >
              {THEME_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isActive = theme === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors outline-none",
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-muted",
                    )}
                  >
                    <Icon className="size-4" />
                    <span>{option.label}</span>
                    {isActive && (
                      <motion.span
                        layoutId="theme-active-indicator"
                        className="ml-auto size-1.5 rounded-full bg-primary"
                      />
                    )}
                  </button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
