// toc-mobile.tsx
// 移动端目录：悬浮按钮 + 底部抽屉
// 修复了原版 max-h 计算字符串错误：`calc(70vh - 56px)` 在 tailwind 中需用 style 属性

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlignLeft, X, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TocItem } from "./useToc";

interface TocMobileProps {
  headings: TocItem[];
  activeId: string;
  onSelect: (id: string) => void;
  minLevel?: number;
}

export function TocMobile({
  headings,
  activeId,
  onSelect,
  minLevel = 2,
}: TocMobileProps) {
  const [open, setOpen] = useState(false);

  if (headings.length === 0) return null;

  const activeHeading = headings.find((h) => h.id === activeId);
  const activeIndex = headings.findIndex((h) => h.id === activeId);

  const handleSelect = (id: string) => {
    onSelect(id);
    setOpen(false);
  };

  return (
    <>
      {/* 悬浮触发按钮 */}
      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => setOpen(true)}
        aria-label="打开目录"
        className={cn(
          "xl:hidden fixed bottom-20 right-4 z-40",
          "flex items-center gap-2 max-w-45",
          "h-10 pl-3 pr-4 rounded-full shadow-lg",
          "bg-card/90 backdrop-blur-md border border-border/60",
          "text-sm text-muted-foreground hover:text-foreground",
          "transition-colors duration-150 select-none",
        )}
      >
        <AlignLeft className="h-4 w-4 shrink-0 text-primary" />
        <span className="truncate text-[12px] font-medium">
          {activeHeading?.text ?? "目录"}
        </span>
      </motion.button>

      {/* 底部抽屉 */}
      <AnimatePresence>
        {open && (
          <>
            {/* 遮罩 */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="xl:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]"
              onClick={() => setOpen(false)}
            />

            {/* 抽屉面板 */}
            <motion.div
              key="drawer"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 34 }}
              className="xl:hidden fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-card border-t border-border shadow-2xl"
              style={{ maxHeight: "72vh" }}
            >
              {/* 拖拽把手 */}
              <div className="flex justify-center pt-2.5 pb-1">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
              </div>

              {/* 顶栏 */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">文章目录</span>
                  <span className="text-[11px] text-muted-foreground/60 tabular-nums">
                    {activeIndex + 1} / {headings.length}
                  </span>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="关闭目录"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* 列表 */}
              <div
                className="overflow-y-auto overscroll-contain px-3 py-2.5
                            [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                style={{ maxHeight: "calc(72vh - 90px)" }}
              >
                <ul className="space-y-0.5">
                  {headings.map((h, idx) => {
                    const isActive = h.id === activeId;
                    const indent = (h.level - minLevel) * 16;

                    return (
                      <motion.li
                        key={h.id}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.018 }}
                      >
                        <button
                          onClick={() => handleSelect(h.id)}
                          className={cn(
                            "group w-full text-left flex items-center gap-2",
                            "py-2.5 px-3 rounded-xl transition-colors duration-100",
                            isActive
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                          )}
                          style={{ paddingLeft: 12 + indent }}
                        >
                          {isActive && (
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-primary" />
                          )}
                          <span
                            className={cn(
                              "text-[13px] leading-snug",
                              isActive ? "font-medium" : "font-normal",
                            )}
                          >
                            {h.text}
                          </span>
                        </button>
                      </motion.li>
                    );
                  })}
                </ul>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
