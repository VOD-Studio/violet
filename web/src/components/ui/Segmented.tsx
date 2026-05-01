// Segmented.tsx
// 分段选择器组件，带滑块动画效果
// 使用 CSS transform 实现，不受父容器高度变化影响

import { useRef, useEffect, useState } from "react"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"

interface SegmentedOption<T extends string | number> {
  /** 显示标签 */
  label: string
  /** 选项值 */
  value: T
}

interface SegmentedProps<T extends string | number> {
  /** 选项列表 */
  options: readonly SegmentedOption<T>[] | SegmentedOption<T>[]
  /** 当前选中值 */
  value: T
  /** 选中值变化回调 */
  onChange: (value: T) => void
  /** 自定义类名 */
  className?: string
}

/**
 * 分段选择器组件
 * 滑块使用绝对定位 + CSS transform，位置稳定不受外部布局影响
 */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  className,
}: SegmentedProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState({ width: 0, left: 0 })

  // 计算滑块位置
  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current
    const buttons = container.querySelectorAll("button")

    buttons.forEach((btn, index) => {
      if (options[index].value === value) {
        const containerRect = container.getBoundingClientRect()
        const btnRect = btn.getBoundingClientRect()

        setIndicatorStyle({
          width: btnRect.width,
          left: btnRect.left - containerRect.left,
        })
      }
    })
  }, [value, options])

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex gap-1 rounded-lg border bg-muted/30 p-1",
        className
      )}
    >
      {/* 滑块背景 - 绝对定位 */}
      <motion.div
        className="absolute top-1 bottom-1 rounded-md bg-background shadow-sm"
        animate={{
          width: indicatorStyle.width,
          left: indicatorStyle.left,
        }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      />

      {/* 选项按钮 */}
      {options.map((opt) => {
        const isActive = opt.value === value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative z-10 flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}