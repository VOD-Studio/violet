// 通知提示组件
// 基于 sonner 实现，提供全局通知能力

import { toast } from "sonner";

/**
 * 通知提供者组件
 * 包裹应用根组件，提供 toast 上下文
 *
 * 注意：Toaster 实例在 __root.tsx 中统一渲染，避免重复
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/**
 * 使用通知的 Hook
 * 返回 sonner 的 toast 函数，保持与原有接口兼容
 */
export function useToast() {
  return {
    toast: (message: string, type: "success" | "error" | "info" = "info") => {
      switch (type) {
        case "success":
          toast.success(message);
          break;
        case "error":
          toast.error(message);
          break;
        default:
          toast(message);
          break;
      }
    },
  };
}
