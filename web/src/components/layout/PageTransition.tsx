// 页面过渡包装组件
// 使用 motion AnimatePresence 实现页面切换动画
// 支持 fade、slide、scale 三种动画类型
// 尊重用户系统的 prefers-reduced-motion 设置

import { type ReactNode, useEffect, useState } from "react"
import { motion, type Variants } from "motion/react"

/** 支持的动画类型 */
type AnimationType = "fade" | "slide" | "scale"

/** 组件属性 */
interface PageTransitionProps {
  /** 子元素 */
  children: ReactNode
  /** 当前路径，用作 AnimatePresence 的 key */
  pathname: string
  /** 动画类型，默认 fade */
  type?: AnimationType
}

/** 淡入淡出动画变体 */
const fadeVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

/** 滑动动画变体 */
const slideVariants: Variants = {
  initial: { opacity: 0, x: 30 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -30 },
}

/** 缩放动画变体 */
const scaleVariants: Variants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 1.04 },
}

/** 根据动画类型获取对应的 variants */
function getVariants(type: AnimationType): Variants {
  switch (type) {
    case "fade":
      return fadeVariants
    case "slide":
      return slideVariants
    case "scale":
      return scaleVariants
  }
}

/**
 * 检测用户是否开启了减少动画偏好
 * 返回 true 表示应该使用简化动画
 */
function useReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(false)

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    setPrefersReduced(query.matches)

    const handler = (event: MediaQueryListEvent) => {
      setPrefersReduced(event.matches)
    }
    query.addEventListener("change", handler)
    return () => query.removeEventListener("change", handler)
  }, [])

  return prefersReduced
}

/**
 * 页面过渡包装组件
 * 使用 AnimatePresence 在页面切换时播放进入/退出动画
 * 当用户系统偏好减少动画时，自动简化为仅透明度过渡
 */
export function PageTransition({
  children,
  pathname,
  type = "fade",
}: PageTransitionProps) {
  const prefersReduced = useReducedMotion()

  // 用户偏好减少动画时，使用无位移的淡入淡出
  const variants = prefersReduced ? fadeVariants : getVariants(type)

  // 减少动画时缩短过渡时间
  const duration = prefersReduced ? 0.15 : 0.3

  return (
    <motion.div
      key={pathname}
      initial="initial"
      animate="animate"
      exit="exit"
      variants={variants}
      transition={{
        duration,
        ease: "easeInOut",
      }}
      className="w-full"
    >
      {children}
    </motion.div>
  )
}
