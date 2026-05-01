import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import type { TocItem } from "./useToc";

interface TocSidebarProps {
  headings: TocItem[];
  activeId: string;
  onSelect: (id: string) => void;
  minLevel?: number;
}

export function TocSidebar({
  headings = [],
  activeId,
  onSelect,
  minLevel = 2,
}: TocSidebarProps) {
  const activeIndex = headings.findIndex((h) => h.id === activeId);

  return (
    <motion.aside
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="xl:flex flex-col fixed right-8 top-24 w-70 max-h-[calc(100vh-7rem)] p-4"
      aria-label="文章目录"
    >
      {/* 标题行 */}
      <div className="flex items-center gap-2 mb-4">
        <span className="font-bold tracking-[0.15em] uppercase text-muted-foreground/60 select-none">
          目录
        </span>
        <div className="flex-1 h-px bg-border/60" />
        <span className="text-muted-foreground/40 tabular-nums">
          {headings.length}
        </span>
      </div>

      {/* 导航列表 */}
      <nav className="overscroll-contain flex-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ul>
          {headings.map((h, idx) => {
            const isActive = h.id === activeId;
            const isPassed = activeIndex >= 0 && idx < activeIndex;
            const isLast = idx === headings.length - 1;
            const connectorPassed = activeIndex >= 0 && idx < activeIndex;
            const indent = (h.level - minLevel) * 14;

            return (
              <motion.li
                key={h.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.025 }}
              >
                <button
                  onClick={() => onSelect(h.id)}
                  title={h.text}
                  // flex + items-start：左列（圆点+线）和右列（文字）各自从顶部对齐
                  className={cn(
                    "group flex items-start gap-3 w-full text-left",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
                  )}
                  style={{ paddingLeft: indent }}
                >
                  {/* ── 左列：圆点 + 圆点下方到下一行圆点上方的连接线 ── */}
                  <div className="flex flex-col items-center shrink-0 pt-0.75">
                    {/* 圆点 */}
                    <span
                      aria-hidden
                      className={cn(
                        "size-2.5 rounded-full border-2 shrink-0 z-10",
                        "transition-all duration-200",
                        isActive
                          ? "bg-primary border-primary scale-125"
                          : isPassed
                            ? "bg-primary/50 border-primary/60"
                            : "bg-background border-border group-hover:border-primary/60"
                      )}
                    />
                    {/* 连接线：只在非最后一项显示，flex-1 填满到下一行圆点顶部 */}
                    {!isLast && (
                      <div
                        aria-hidden
                        className={cn(
                          "w-px mt-1 flex-1 min-h-3 rounded-full transition-colors duration-200",
                          connectorPassed ? "bg-primary/50" : "bg-border/40"
                        )}
                      />
                    )}
                  </div>

                  {/* ── 右列：文字，pb-3 撑开行高供连接线填充 ── */}
                  <span
                    className={cn(
                      "truncate text-[12.5px] leading-snug transition-colors duration-150",
                      // 非最后一项加 pb，给连接线留出自然间距
                      !isLast && "pb-3",
                      isActive
                        ? "text-primary font-semibold"
                        : isPassed
                          ? "text-muted-foreground/50"
                          : "text-muted-foreground group-hover:text-foreground"
                    )}
                  >
                    {h.text}
                  </span>
                </button>
              </motion.li>
            );
          })}
        </ul>
      </nav>
    </motion.aside>
  );
}
