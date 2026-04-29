// 通知提示组件
// 轻量级的全局通知系统，支持成功、错误、信息类型

import { useState, useEffect, useCallback, createContext, useContext } from "react"
import { cn } from "@/lib/utils"

/** 通知类型 */
type ToastType = "success" | "error" | "info"

/** 通知数据结构 */
interface Toast {
  id: string
  type: ToastType
  message: string
}

/** 通知上下文接口 */
interface ToastContextValue {
  /** 显示通知 */
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

/**
 * 通知提供者组件
 * 包裹应用根组件，提供全局通知能力
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  /** 添加通知 */
  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, type, message }])
  }, [])

  /** 移除通知 */
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* 通知容器，固定在右下角 */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/**
 * 使用通知的 Hook
 * 必须在 ToastProvider 内部使用
 */
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast 必须在 ToastProvider 内部使用")
  }
  return context
}

/** 通知类型对应的颜色样式 */
const typeStyles: Record<ToastType, string> = {
  success: "border-green-500 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200",
  error: "border-destructive bg-destructive/10 text-destructive",
  info: "border-primary bg-primary/10 text-primary",
}

/** 单条通知组件 */
function ToastItem({
  toast,
  onRemove,
}: {
  toast: Toast
  onRemove: (id: string) => void
}) {
  /** 3 秒后自动消失 */
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 3000)
    return () => clearTimeout(timer)
  }, [toast.id, onRemove])

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-md transition-all animate-in slide-in-from-right",
        typeStyles[toast.type],
      )}
    >
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        className="shrink-0 opacity-60 hover:opacity-100"
      >
        <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
