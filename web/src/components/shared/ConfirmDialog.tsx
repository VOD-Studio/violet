// 确认弹窗组件
// 用于删除等危险操作的二次确认

import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

/** 确认弹窗属性 */
interface ConfirmDialogProps {
  /** 是否显示弹窗 */
  open: boolean
  /** 关闭弹窗回调 */
  onClose: () => void
  /** 确认回调 */
  onConfirm: () => void | Promise<void>
  /** 标题 */
  title?: string
  /** 描述文字 */
  description?: string
  /** 确认按钮文字 */
  confirmLabel?: string
  /** 取消按钮文字 */
  cancelLabel?: string
  /** 是否为危险操作（红色确认按钮） */
  destructive?: boolean
  /** 是否正在执行 */
  isLoading?: boolean
}

/**
 * 确认弹窗组件
 * 提供确认/取消操作，支持危险操作样式和加载状态
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "确认操作",
  description = "此操作不可撤销，是否继续？",
  confirmLabel = "确认",
  cancelLabel = "取消",
  destructive = false,
  isLoading = false,
}: ConfirmDialogProps) {
  /** 处理确认操作 */
  const handleConfirm = useCallback(async () => {
    await onConfirm()
    onClose()
  }, [onConfirm, onClose])

  /** 按 Escape 关闭弹窗 */
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={onClose}
      />
      {/* 弹窗内容 */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? "处理中..." : confirmLabel}
          </Button>
        </div>
      </div>
    </>
  )
}
