// 动态文字组件
// 逐字符或逐词入场动画，支持交错延迟效果

import { type ReactNode } from "react"
import { motion, type Variants } from "motion/react"
import { useReducedMotion } from "@/hooks/useReducedMotion"

/** 支持的动画类型 */
type AnimationType = "fadeUp" | "scale" | "rotate"

/** 拆分粒度 */
type SplitMode = "char" | "word"

interface KineticTextProps {
  /** 文本内容 */
  children: string
  /** 动画类型，默认 fadeUp */
  animation?: AnimationType
  /** 拆分粒度：逐字符或逐词，默认 char */
  splitMode?: SplitMode
  /** 子动画之间的交错延迟（秒），默认 0.03 */
  staggerDelay?: number
  /** 整体动画延迟（秒），默认 0 */
  delay?: number
  /** 作为哪个 HTML 元素渲染，默认 span */
  as?: "span" | "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
  /** 额外的 CSS 类名 */
  className?: string
}

/** 根据动画类型返回单个元素的 variants */
function getElementVariants(animation: AnimationType): Variants {
  switch (animation) {
    case "fadeUp":
      return {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 },
      }
    case "scale":
      return {
        hidden: { opacity: 0, scale: 0 },
        visible: { opacity: 1, scale: 1 },
      }
    case "rotate":
      return {
        hidden: { opacity: 0, rotate: -90 },
        visible: { opacity: 1, rotate: 0 },
      }
  }
}

/** 将文本按指定模式拆分为片段 */
function splitText(text: string, mode: SplitMode): string[] {
  if (mode === "word") {
    return text.split(/(\s+)/).filter(Boolean)
  }
  // 逐字符拆分，保留空格
  return text.split("")
}

/**
 * 动态文字组件
 * 文本以逐字符或逐词方式依次入场，视觉效果生动
 */
export function KineticText({
  children,
  animation = "fadeUp",
  splitMode = "char",
  staggerDelay = 0.03,
  delay = 0,
  as: Tag = "span",
  className,
}: KineticTextProps) {
  const prefersReduced = useReducedMotion()
  const segments = splitText(children, splitMode)

  // 尊重减少动画偏好：直接显示文本
  if (prefersReduced) {
    return <Tag className={className}>{children}</Tag>
  }

  const elementVariants = getElementVariants(animation)

  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: delay,
      },
    },
  }

  return (
    <Tag className={className} aria-label={children}>
      <motion.span
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={containerVariants}
        aria-hidden
        style={{ display: "inline" }}
      >
        {segments.map((segment, index) => (
          <motion.span
            key={index}
            variants={elementVariants}
            transition={{ duration: 0.3, ease: "easeOut" }}
            style={{
              display: "inline-block",
              whiteSpace: segment === " " ? "pre" : undefined,
            }}
          >
            {segment === " " ? " " : segment}
          </motion.span>
        ))}
      </motion.span>
    </Tag>
  )
}
