// 错误回退组件
// 当页面或组件加载失败时显示错误提示和重试按钮

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** 错误回退组件属性 */
interface ErrorFallbackProps {
  /** 错误信息 */
  error?: string | null;
  /** 重试回调 */
  onRetry?: () => void;
  /** 自定义类名 */
  className?: string;
}

/**
 * 错误回退组件
 * 显示错误信息和重试按钮，用于页面级或组件级错误展示
 */
export function ErrorFallback({
  error,
  onRetry,
  className,
}: ErrorFallbackProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 text-center",
        className,
      )}
    >
      {/* 错误图标 */}
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <svg
          className="size-6 text-destructive"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
          />
        </svg>
      </div>

      <h3 className="text-lg font-medium text-foreground">加载失败</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {error ?? "发生了未知错误，请稍后重试"}
      </p>

      {onRetry && (
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          重新加载
        </Button>
      )}
    </div>
  );
}
