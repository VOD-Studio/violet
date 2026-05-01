// 文章目录导航组件
// 从 HTML 内容提取标题，生成侧边栏目录导航

import { useState, useEffect, useMemo, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import { List } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** 目录项结构 */
interface TocItem {
  /** 标题 ID */
  id: string
  /** 标题文本 */
  text: string
  /** 标题级别 (1-6) */
  level: number
}

interface TableOfContentsProps {
  /** HTML 内容 */
  html: string
  /** 最小显示标题级别 */
  minLevel?: number
  /** 最大显示标题级别 */
  maxLevel?: number
}

/**
 * 从 HTML 中提取标题列表
 */
function extractHeadings(html: string, minLevel: number, maxLevel: number): TocItem[] {
  const headings: TocItem[] = []
  const regex = /<h([1-6])[^>]*>(.*?)<\/h\1>/gi
  let match
  let index = 0

  while ((match = regex.exec(html)) !== null) {
    const level = parseInt(match[1])
    if (level >= minLevel && level <= maxLevel) {
      // 提取文本内容（去除内嵌标签）
      const textMatch = match[2].replace(/<[^>]+>/g, "").trim()
      if (textMatch) {
        headings.push({
          id: `toc-${index}`,
          text: textMatch,
          level,
        })
        index++
      }
    }
  }

  return headings
}

/**
 * 文章目录导航组件
 */
export function TableOfContents({
  html,
  minLevel = 2,
  maxLevel = 4,
}: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>("")
  const [isOpen, setIsOpen] = useState(true)

  // 提取标题列表
  const headings = useMemo(
    () => extractHeadings(html, minLevel, maxLevel),
    [html, minLevel, maxLevel]
  )

  // 监听滚动，更新当前激活的标题
  useEffect(() => {
    if (headings.length === 0) return

    const handleScroll = () => {
      // 找到当前可见区域内最靠近顶部的标题
      const offset = 100 // 顶部偏移量

      let currentId = headings[0]?.id
      let minDistance = Infinity

      headings.forEach(({ id }) => {
        const el = document.getElementById(id)
        if (el) {
          const rect = el.getBoundingClientRect()
          const distance = rect.top - offset
          // 标题在视口上方或刚好进入视口
          if (distance < 50 && Math.abs(distance) < minDistance) {
            minDistance = Math.abs(distance)
            currentId = id
          }
        }
      })

      setActiveId(currentId)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    handleScroll() // 初始化

    return () => window.removeEventListener("scroll", handleScroll)
  }, [headings])

  // 点击跳转到指定标题
  const scrollToHeading = useCallback((id: string) => {
    const el = document.getElementById(id)
    if (el) {
      const offset = 80 // 顶部导航栏高度
      const top = el.getBoundingClientRect().top + window.scrollY - offset
      window.scrollTo({ top, behavior: "smooth" })
      setActiveId(id)
    }
  }, [])

  if (headings.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="hidden xl:block fixed right-8 top-[100px] w-60 max-h-[calc(100vh-120px)]"
    >
      {/* 标题 */}
      <div className="flex items-center gap-2 mb-3">
        <List className="size-4 text-primary" />
        <span className="text-sm font-medium">目录导航</span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-auto h-6 w-6"
          onClick={() => setIsOpen(!isOpen)}
        >
          <motion.span
            animate={{ rotate: isOpen ? 0 : -90 }}
            transition={{ duration: 0.2 }}
          >
            ▼
          </motion.span>
        </Button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="overflow-auto max-h-[calc(100vh-180px)]"
          >
            <nav className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-sm">
              <ul className="py-2">
                {headings.map((heading, idx) => (
                  <li
                    key={heading.id}
                    className={cn(
                      "relative",
                      idx > 0 && headings[idx - 1].level < heading.level && "mt-1"
                    )}
                  >
                    {/* 激活指示条 */}
                    {activeId === heading.id && (
                      <motion.div
                        layoutId="toc-active"
                        className="absolute left-0 top-1 bottom-1 w-1 bg-primary rounded-full"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}

                    <button
                      onClick={() => scrollToHeading(heading.id)}
                      className={cn(
                        "w-full text-left text-sm py-1.5 pr-3 transition-all duration-200",
                        "hover:text-primary hover:bg-primary/5",
                        activeId === heading.id
                          ? "text-primary font-medium bg-primary/10"
                          : "text-muted-foreground",
                        heading.level === minLevel && "pl-4",
                        heading.level === minLevel + 1 && "pl-6",
                        heading.level >= minLevel + 2 && "pl-8"
                      )}
                    >
                      <span className="truncate block">{heading.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}