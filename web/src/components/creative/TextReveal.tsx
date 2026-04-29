// 文字逐行显示组件
// 长文本段落按行滚动显示，适合大段叙述内容

import { type ReactNode, useRef, useEffect, useState } from "react"
import { motion } from "motion/react"
import { useReducedMotion } from "@/hooks/useReducedMotion"

interface TextRevealProps {
  /** 文本内容，每个子元素作为一行 */
  children: ReactNode
  /** 动画持续时间（秒），默认 0.6 */
  duration?: number
  /** 行间交错延迟（秒），默认 0.15 */
  staggerDelay?: number
  /** 触发偏移量，控制动画开始时机，默认 "0px 0px -80px 0px" */
  rootMargin?: string
  /** 额外的 CSS 类名 */
  className?: string
}

/**
 * 文字逐行显示组件
 * 将子元素视为独立行，滚动到视口时依次显示
 */
export function TextReveal({
  children,
  duration = 0.6,
  staggerDelay = 0.15,
  rootMargin = "0px 0px -80px 0px",
  className,
}: TextRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const prefersReduced = useReducedMotion()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin },
    )
    observer.observe(el)

    return () => observer.disconnect()
  }, [rootMargin])

  // 将 children 转为数组，逐行动画
  const lines = Array.isArray(children) ? children : [children]

  // 减少动画偏好下直接显示
  if (prefersReduced) {
    return <div className={className}>{children}</div>
  }

  return (
    <div ref={containerRef} className={className}>
      {lines.map((line, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={
            isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
          }
          transition={{
            duration,
            delay: index * staggerDelay,
            ease: "easeOut",
          }}
        >
          {line}
        </motion.div>
      ))}
    </div>
  )
}
