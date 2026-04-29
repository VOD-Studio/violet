// 骨架屏组件
// 用于加载态占位显示

import { cn } from "@/lib/utils"

/**
 * 骨架屏组件
 * 用于数据加载时的占位显示，支持自定义样式
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
