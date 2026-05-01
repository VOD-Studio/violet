// 文章目录导航组件
// 从 HTML 内容提取标题，生成侧边栏目录导航

import { useState, useEffect, useMemo, useCallback } from "react"
import { motion } from "motion/react"
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
  const regex = /<h([1-6])[^>]*id="toc-\d+"[^>]*>(.*?)<\/h\1>/gi
  let match

  while ((match = regex.exec(html)) !== null) {
    const level = parseInt(match[1])
    if (level >= minLevel && level <= maxLevel) {
      // 提取 id
      const idMatch = match[0].match(/id="(toc-\d+)"/)
      const id = idMatch ? idMatch[1] : ""
      // 提取文本内容（去除内嵌标签）
      const textMatch = match[2].replace(/<[^>]+>/g, "").trim()
      if (textMatch && id) {
        headings.push({
          id,
          text: textMatch,
          level,
        })
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

  // 提取标题列表
  const headings = useMemo(
    () => extractHeadings(html, minLevel, maxLevel),
    [html, minLevel, maxLevel]
  )

  // 监听滚动，更新当前激活的标题
  useEffect(() => {
    if (headings.length === 0) return

    const handleScroll = () => {
      const offset = 100 // 顶部偏移量
      let currentId = ""
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

      if (currentId && currentId !== activeId) {
        setActiveId(currentId)
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    handleScroll() // 初始化

    return () => window.removeEventListener("scroll", handleScroll)
  }, [headings, activeId])

  // 点击跳转到指定标题
  const scrollToHeading = useCallback((id: string) => {
    const el = document.getElementById(id)
    if (el) {
      const offset = 80
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
      transition={{ delay: 0.3 }}
      className="hidden xl:block fixed right-8 top-[100px] w-56 max-h-[calc(100vh-140px)]"
    >
      {/* 标题 */}
      <div className="flex items-center justify-between mb-4 px-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          目录
        </span>
        <span className="text-xs text-muted-foreground">
          {headings.length} 节
        </span>
      </div>

      {/* 目录列表 */}
      <nav className="relative">
        {/* 进度条背景 */}
        <div className="absolute left-[10px] top-0 bottom-0 w-[2px] bg-border/50 rounded-full" />

        {/* 激活进度条 */}
        {activeId && (
          <motion.div
            className="absolute left-[10px] w-[2px] bg-primary rounded-full"
            initial={{ height: 0 }}
            animate={{
              height: `${((headings.findIndex(h => h.id === activeId) + 1) / headings.length) * 100}%`,
            }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
          />
        )}

        <ul className="space-y-0">
          {headings.map((heading, idx) => {
            const isActive = activeId === heading.id
            const indent = (heading.level - minLevel) * 8

            return (
              <motion.li
                key={heading.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + idx * 0.02 }}
              >
                <button
                  onClick={() => scrollToHeading(heading.id)}
                  className={cn(
                    "group relative w-full text-left py-2 transition-all duration-200",
                    "flex items-center gap-2",
                    indent > 0 && `pl-[${indent}px]`
                  )}
                  style={{ paddingLeft: indent > 0 ? indent : 0 }}
                >
                  {/* 左侧圆点指示器 */}
                  <span
                    className={cn(
                      "relative z-10 flex items-center justify-center",
                      "w-[22px] h-[22px] rounded-full transition-all duration-200",
                      isActive
                        ? "bg-primary text-primary-foreground scale-100"
                        : "bg-muted/50 text-muted-foreground group-hover:bg-muted scale-90 group-hover:scale-100"
                    )}
                  >
                    {isActive && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="text-[10px] font-bold"
                      >
                        ✓
                      </motion.span>
                    )}
                  </span>

                  {/* 标题文本 */}
                  <span
                    className={cn(
                      "flex-1 text-[13px] leading-tight transition-colors duration-200",
                      isActive
                        ? "text-foreground font-semibold"
                        : "text-muted-foreground group-hover:text-foreground",
                      "truncate"
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
}