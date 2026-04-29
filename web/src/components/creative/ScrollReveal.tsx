// 滚动显示动画组件
// 元素进入视口时触发动画，支持多种动画类型和配置

import { type ReactNode } from "react"
import { motion, type Variants } from "motion/react"
import { useReducedMotion } from "@/hooks/useReducedMotion"

/** 支持的动画类型 */
type AnimationType = "fadeUp" | "fadeIn" | "slideLeft" | "slideRight" | "scale"

interface ScrollRevealProps {
  /** 子元素 */
  children: ReactNode
  /** 动画类型，默认 fadeUp */
  animation?: AnimationType
  /** 动画延迟（秒），默认 0 */
  delay?: number
  /** 动画持续时间（秒），默认 0.5 */
  duration?: number
  /** 是否只播放一次，默认 true */
  once?: boolean
  /** 额外的 CSS 类名 */
  className?: string
}

/** 根据动画类型返回对应的 variants 配置 */
function getVariants(animation: AnimationType): Variants {
  switch (animation) {
    case "fadeUp":
      return {
        hidden: { opacity: 0, y: 30 },
        visible: { opacity: 1, y: 0 },
      }
    case "fadeIn":
      return {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
      }
    case "slideLeft":
      return {
        hidden: { opacity: 0, x: -50 },
        visible: { opacity: 1, x: 0 },
      }
    case "slideRight":
      return {
        hidden: { opacity: 0, x: 50 },
        visible: { opacity: 1, x: 0 },
      }
    case "scale":
      return {
        hidden: { opacity: 0, scale: 0.85 },
        visible: { opacity: 1, scale: 1 },
      }
  }
}

/**
 * 滚动显示动画组件
 * 元素滚动到视口时播放入场动画，尊重用户减少动画偏好
 */
export function ScrollReveal({
  children,
  animation = "fadeUp",
  delay = 0,
  duration = 0.5,
  once = true,
  className,
}: ScrollRevealProps) {
  const prefersReduced = useReducedMotion()

  // 尊重减少动画偏好：直接显示最终状态
  if (prefersReduced) {
    return <div className={className}>{children}</div>
  }

  const variants = getVariants(animation)

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: "-50px" }}
      variants={variants}
      transition={{ duration, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
