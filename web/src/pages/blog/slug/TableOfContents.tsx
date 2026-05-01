// 文章目录导航组件
// 从 HTML 内容提取标题，生成侧边栏目录导航

import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "motion/react"
import { List, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

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
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, "text/html")

  const headingElements = doc.querySelectorAll("h1, h2, h3, h4, h5, h6")

  headingElements.forEach((el, index) => {
    const level = parseInt(el.tagName.charAt(1))
    if (level >= minLevel && level <= maxLevel) {
      // 为标题生成唯一 ID（如果没有）
      const existingId = el.getAttribute("id")
      const id = existingId || `heading-${index}`
      if (!existingId) {
        el.setAttribute("id", id)
      }
      headings.push({
        id,
        text: el.textContent || "",
        level,
      })
    }
  })

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

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.getAttribute("id") || "")
          }
        })
      },
      {
        rootMargin: "-80px 0px -80% 0px",
        threshold: 0,
      }
    )

    // 观察所有标题元素
    headings.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [headings])

  // 点击跳转到指定标题
  function scrollToHeading(id: string) {
    const el = document.getElementById(id)
    if (el) {
      const offset = 80 // 顶部导航栏高度
      const top = el.getBoundingClientRect().top + window.scrollY - offset
      window.scrollTo({ top, behavior: "smooth" })
      setActiveId(id)
    }
  }

  if (headings.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="hidden lg:block fixed right-8 top-[120px] w-56"
    >
      {/* 折叠按钮 */}
      <Button
        variant="ghost"
        size="sm"
        className="mb-2 gap-1 text-muted-foreground"
        onClick={() => setIsOpen(!isOpen)}
      >
        <List className="size-4" />
        目录导航
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <nav className="rounded-lg border bg-muted/30 p-3">
              <ul className="space-y-1">
                {headings.map((heading) => (
                  <li
                    key={heading.id}
                    style={{ paddingLeft: `${(heading.level - minLevel) * 12}px` }}
                  >
                    <button
                      onClick={() => scrollToHeading(heading.id)}
                      className={`group flex w-full items-center gap-1 text-left text-sm transition-colors ${
                        activeId === heading.id
                          ? "text-primary font-medium"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <ChevronRight
                        className={`size-3 transition-transform ${
                          activeId === heading.id ? "rotate-90" : "rotate-0 group-hover:rotate-45"
                        }`}
                      />
                      <span className="truncate">{heading.text}</span>
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