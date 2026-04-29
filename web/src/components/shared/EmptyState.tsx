// 空状态组件
// 当列表无数据时显示友好的空状态提示

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

/** 空状态组件属性 */
interface EmptyStateProps {
  /** 标题 */
  title?: string
  /** 描述文字 */
  description?: string
  /** 操作按钮文字 */
  actionLabel?: string
  /** 操作按钮点击回调 */
  onAction?: () => void
  /** 自定义图标（SVG 或文字） */
  icon?: React.ReactNode
  /** 自定义类名 */
  className?: string
}

/**
 * 空状态组件
 * 当数据为空时显示图标、标题、描述和可选的操作按钮
 */
export function EmptyState({
  title = "暂无数据",
  description,
  actionLabel,
  onAction,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 text-center",
        className,
      )}
    >
      {icon && (
        <div className="mb-4 text-muted-foreground">{icon}</div>
      )}
      <h3 className="text-lg font-medium text-foreground">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
