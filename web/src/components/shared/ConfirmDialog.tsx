/**
 * 确认弹窗组件
 * 用于删除等危险操作的二次确认
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Info } from "lucide-react"

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
  /** 是否为危险操作（红色确认按钮 + 警告图标） */
  destructive?: boolean
  /** 是否正在执行 */
  isLoading?: boolean
}

/**
 * 确认弹窗组件
 * 复用 Dialog 组件的动画系统，提供确认/取消操作
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
  async function handleConfirm() {
    await onConfirm()
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="gap-3">
          <div className={`flex items-center gap-3 ${destructive ? "text-destructive" : "text-primary"}`}>
            {destructive ? (
              <AlertTriangle className="size-5" />
            ) : (
              <Info className="size-5" />
            )}
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription className="text-left">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
