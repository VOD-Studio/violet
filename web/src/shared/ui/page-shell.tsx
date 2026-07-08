import { cn } from "@shared/lib/utils";
import type { ReactNode } from "react";

interface PageShellProps {
    /** 页面主体内容 */
    children: ReactNode;
    /** 额外 className（与默认容器类合并） */
    className?: string;
}

/**
 * PageShell - 前台标准页面容器
 *
 * 统一前台内容页的容器宽度、内边距和最小高度，
 * 让 View Transitions 在页面切换时快照尺寸更一致，减少 morph 抖动。
 *
 * 提供的样式：
 * - container mx-auto：响应式最大宽度 + 居中
 * - px-4 md:px-6：一致的水平内边距
 * - py-8 md:py-12：一致的垂直内边距
 * - min-h-[calc(100dvh-4rem)]：至少填满视口减去 Header（h-16 = 4rem）的高度
 *
 * 不适用场景：首页、关于页等有全宽 Hero 区的沉浸式页面，
 * 这些页面自行管理布局（已有 min-h-screen 提供一致的最小高度）。
 */
export function PageShell({ children, className }: PageShellProps) {
    return (
        <div
            className={cn(
                "container mx-auto min-h-[calc(100dvh-4rem)] px-4 py-8 md:px-6 md:py-12",
                className,
            )}
        >
            {children}
        </div>
    );
}
