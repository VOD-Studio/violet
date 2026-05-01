// 回到顶部按钮组件
// 带有创意动画效果，滚动一定距离后显示

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { ArrowUp, Rocket, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"

interface BackToTopProps {
  /** 触发显示的滚动距离阈值 */
  threshold?: number
  /** 滚动容器选择器，默认为 window */
  containerSelector?: string
  /** 动画风格 */
  variant?: "arrow" | "rocket" | "chevron"
}

/**
 * 回到顶部按钮
 * 滚动超过阈值后显示，点击后平滑滚动到顶部
 */
export function BackToTop({
  threshold = 300,
  containerSelector,
  variant = "rocket",
}: BackToTopProps) {
  const [visible, setVisible] = useState(false)
  const [isScrolling, setIsScrolling] = useState(false)

  useEffect(() => {
    const container = containerSelector
      ? document.querySelector(containerSelector)
      : window

    if (!container) return

    let timeoutId: ReturnType<typeof setTimeout>

    function handleScroll() {
      const scrollTop = containerSelector
        ? (container as Element).scrollTop
        : window.scrollY

      setVisible(scrollTop > threshold)
      setIsScrolling(true)

      // 滚动停止后隐藏滚动状态
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        setIsScrolling(false)
      }, 150)
    }

    container.addEventListener("scroll", handleScroll, { passive: true })
    return () => {
      container.removeEventListener("scroll", handleScroll)
      clearTimeout(timeoutId)
    }
  }, [threshold, containerSelector])

  function scrollToTop() {
    if (containerSelector) {
      const container = document.querySelector(containerSelector)
      container?.scrollTo({ top: 0, behavior: "smooth" })
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  const icons = {
    arrow: ArrowUp,
    rocket: Rocket,
    chevron: ChevronUp,
  }

  const Icon = icons[variant]

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.5, y: 20 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 20,
          }}
          className="fixed bottom-8 right-8 z-50"
        >
          <Button
            size="icon"
            className="h-12 w-12 rounded-full shadow-lg backdrop-blur-sm bg-primary/90 hover:bg-primary"
            onClick={scrollToTop}
          >
            <motion.div
              animate={{
                y: isScrolling ? [-2, 2, -2] : 0,
                rotate: variant === "rocket" ? (isScrolling ? [0, -15, 15, 0] : 0) : 0,
              }}
              transition={{
                duration: 0.5,
                repeat: isScrolling ? Infinity : 0,
                ease: "easeInOut",
              }}
            >
              <Icon className="h-5 w-5" />
            </motion.div>
          </Button>

          {/* 火箭尾焰效果 */}
          {variant === "rocket" && isScrolling && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 0.3, repeat: Infinity }}
              className="absolute -bottom-2 left-1/2 -translate-x-1/2"
            >
              <div className="h-4 w-2 rounded-full bg-gradient-to-t from-orange-500 via-yellow-400 to-transparent blur-sm" />
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}