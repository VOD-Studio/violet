// 文章目录导航组件
// 从 DOM 中提取已渲染的标题，生成侧边栏目录导航
// 支持桌面端侧边栏和移动端悬浮按钮

import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "motion/react"
import { List, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

/** 目录项结构 */
interface TocItem {
  id: string
  text: string
  level: number
}

interface TableOfContentsProps {
  minLevel?: number
  maxLevel?: number
}

/**
 * 文章目录导航组件
 */
export function TableOfContents({
  minLevel = 2,
  maxLevel = 4,
}: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>("")
  const [headings, setHeadings] = useState<TocItem[]>([])
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 组件挂载后延迟执行（等待文章内容渲染）
  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      setMounted(true)
    }, 500)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  // 挂载后提取标题并设置观察器
  useEffect(() => {
    if (!mounted) return

    const proseContainer = document.querySelector(".prose")
    if (!proseContainer) {
      // 如果还是没有，再等一会
      timeoutRef.current = setTimeout(() => {
        setMounted(true) // 重新触发
      }, 300)
      return
    }

    const headingElements = proseContainer.querySelectorAll("h2, h3, h4")
    const items: TocItem[] = []

    headingElements.forEach((el, index) => {
      const level = parseInt(el.tagName.charAt(1))
      if (level >= minLevel && level <= maxLevel) {
        const id = el.getAttribute("id") || `heading-${index}-${level}`
        if (!el.getAttribute("id")) {
          el.setAttribute("id", id)
        }
        el.classList.add("scroll-mt-20")
        items.push({ id, text: el.textContent || "", level })
      }
    })

    setHeadings(items)

    // 断开旧的观察器
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    // 创建新的观察器
    observerRef.current = new IntersectionObserver(
      (entries) => {
        // 找到最靠近顶部的可见标题
        const visibleEntries = entries.filter((e) => e.isIntersecting)
        if (visibleEntries.length > 0) {
          const closest = visibleEntries.reduce((prev, curr) => {
            const prevTop = Math.abs(prev.boundingClientRect.top)
            const currTop = Math.abs(curr.boundingClientRect.top)
            return currTop < prevTop ? curr : prev
          })
          const newId = closest.target.getAttribute("id") || ""
          if (newId !== activeId) {
            setActiveId(newId)
          }
        } else {
          // 没有可见的标题，检查哪个最近
          const allEntries = entries
          const closestAbove = allEntries
            .filter((e) => e.boundingClientRect.top < 80)
            .sort((a, b) => b.boundingClientRect.top - a.boundingClientRect.top)[0]
          if (closestAbove) {
            const newId = closestAbove.target.getAttribute("id") || ""
            if (newId !== activeId) {
              setActiveId(newId)
            }
          }
        }
      },
      {
        rootMargin: "-80px 0px -80% 0px",
        threshold: 0,
      }
    )

    // 观察所有标题
    items.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el && observerRef.current) {
        observerRef.current.observe(el)
      }
    })

    // 初始化时设置第一个标题为激活
    if (items.length > 0 && !activeId) {
      setActiveId(items[0].id)
    }
  }, [mounted, minLevel, maxLevel, activeId])

  // 清理
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  // 点击跳转到指定标题
  const scrollToHeading = useCallback((id: string) => {
    const el = document.getElementById(id)
    if (el) {
      const offset = 80
      const top = el.getBoundingClientRect().top + window.scrollY - offset
      window.scrollTo({ top, behavior: "smooth" })
      setActiveId(id)
      setMobileOpen(false)
    }
  }, [])

  if (headings.length === 0) return null

  // 桌面端侧边栏
  const DesktopToc = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 }}
      className="hidden lg:block fixed right-6 top-[100px] w-52"
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          目录
        </span>
        <span className="text-xs text-muted-foreground">{headings.length}</span>
      </div>

      <nav className="relative rounded-lg border bg-card/80 backdrop-blur-sm p-2">
        {/* 进度指示线 */}
        <div className="absolute left-[11px] top-2 bottom-2 w-[2px] bg-border rounded-full" />
        {activeId && (
          <motion.div
            className="absolute left-[11px] w-[2px] bg-primary rounded-full"
            initial={{ height: 0 }}
            animate={{
              height: `${((headings.findIndex((h) => h.id === activeId) + 1) / headings.length) * 100}%`,
            }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{ top: 8 }}
          />
        )}

        <ul className="space-y-0.5">
          {headings.map((heading, idx) => {
            const isActive = activeId === heading.id
            const indent = (heading.level - minLevel) * 10

            return (
              <motion.li
                key={heading.id}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 + idx * 0.03 }}
              >
                <button
                  onClick={() => scrollToHeading(heading.id)}
                  className={cn(
                    "group w-full text-left py-1.5 transition-all",
                    "flex items-center gap-2 rounded-md",
                    isActive && "bg-primary/10",
                    "hover:bg-muted/50"
                  )}
                  style={{ paddingLeft: indent > 0 ? indent : 0 }}
                >
                  {/* 圆点 */}
                  <span
                    className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center shrink-0",
                      "transition-all duration-200",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted border group-hover:border-primary/50"
                    )}
                  >
                    {isActive && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="text-[10px]"
                      >
                        ✓
                      </motion.span>
                    )}
                  </span>
                  {/* 文本 */}
                  <span
                    className={cn(
                      "text-[13px] truncate transition-colors",
                      isActive
                        ? "text-primary font-medium"
                        : "text-muted-foreground group-hover:text-foreground"
                    )}
                  >
                    {heading.text}
                  </span>
                </button>
              </motion.li>
            )
          })}
        </ul>
      </nav>
    </motion.div>
  )

  // 移动端悬浮按钮 + 弹出面板
  const MobileToc = () => (
    <>
      {/* 悬浮按钮 */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="lg:hidden fixed bottom-20 right-4 z-40"
      >
        <Button
          variant="secondary"
          size="icon"
          className="h-12 w-12 rounded-full shadow-lg bg-card/90 backdrop-blur-sm border"
          onClick={() => setMobileOpen(true)}
        >
          <List className="h-5 w-5" />
        </Button>
      </motion.div>

      {/* 弹出面板 */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* 背景遮罩 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />

            {/* 目录面板 */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="lg:hidden fixed bottom-0 left-0 right-0 z-50 max-h-[70vh] rounded-t-2xl bg-card border-t shadow-xl"
            >
              {/* 头部 */}
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <span className="font-semibold">文章目录</span>
                <Button variant="ghost" size="icon-sm" onClick={() => setMobileOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* 目录列表 */}
              <div className="overflow-auto max-h-[calc(70vh - 56px)] p-4">
                <ul className="space-y-1">
                  {headings.map((heading, idx) => {
                    const isActive = activeId === heading.id
                    const indent = (heading.level - minLevel) * 16

                    return (
                      <motion.li
                        key={heading.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.02 + idx * 0.02 }}
                      >
                        <button
                          onClick={() => scrollToHeading(heading.id)}
                          className={cn(
                            "w-full text-left py-2.5 px-3 rounded-lg transition-all",
                            isActive && "bg-primary/15 text-primary font-medium",
                            !isActive && "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                          )}
                          style={{ paddingLeft: indent > 0 ? indent + 12 : 12 }}
                        >
                          {heading.text}
                        </button>
                      </motion.li>
                    )
                  })}
                </ul>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )

  return (
    <>
      <DesktopToc />
      <MobileToc />
    </>
  )
}