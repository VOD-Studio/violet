// 加载动画组件
// 用于页面或组件加载时的旋转动画提示

import { cn } from "@/lib/utils";

/** 加载动画组件属性 */
interface LoadingSpinnerProps {
  /** 尺寸 */
  size?: "sm" | "md" | "lg";
  /** 自定义类名 */
  className?: string;
  /** 加载提示文字 */
  text?: string;
}

/** 尺寸映射 */
const sizeClasses = {
  sm: "size-4",
  md: "size-6",
  lg: "size-8",
} as const;

/**
 * 加载动画组件
 * 显示旋转的加载图标，可选显示加载文字
 */
export function LoadingSpinner({
  size = "md",
  className,
  text,
}: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2",
        className,
      )}
    >
      <svg
        className={cn("animate-spin text-muted-foreground", sizeClasses[size])}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {text && <p className="text-sm text-muted-foreground">{text}</p>}
    </div>
  );
}
