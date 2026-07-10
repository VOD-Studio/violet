import type { ReactNode } from "react";

interface PageShellProps {
    /** 页面主标题（h1，唯一来源，由 shell 渲染） - 注意：TopBar 已显示标题，此处不再渲染 */
    title: string;
    /** 副标题描述 */
    description?: string;
    /** 标题区右侧操作（如「创建分组」按钮） */
    action?: ReactNode;
    /** 固定在标题区下方的额外内容（如表格工具栏、筛选器），随标题区一起 sticky */
    sticky?: ReactNode;
    /** 页面主体内容 */
    children: ReactNode;
}

/**
 * PageShell - 后台页面内容壳
 *
 * 统一后台页面的副标题、操作区与内容区间距。
 * 注意：页面主标题 (h1) 已由 TopBar 渲染，此组件不再重复显示。
 *
 * 标题区始终保持固定高度（min-h-8 = 按钮 size-sm 的高度），
 * 即使某页面没有 action 按钮（如只读页），切换页面时也不会因高度变化而抖动。
 *
 * 标题区（含 description + action + sticky）默认 sticky 固定在顶部，
 * 内容过长滚动时标题区和 sticky 内容不会随页面滚走。
 */
export function PageShell({ description, action, sticky, children }: PageShellProps) {
    // 既无描述也无操作且无 sticky 内容时，直接渲染内容（无标题区，不占额外空间）
    if (!description && !action && !sticky) {
        return <div>{children}</div>;
    }

    return (
        <div className="space-y-6">
            {/* 标题区 + sticky 内容：sticky top-0 固定在滚动容器顶部 */}
            <div className="sticky top-0 z-10 bg-background/95 pb-2 backdrop-blur">
                {/* 副标题和操作区：固定高度避免有无按钮时抖动 */}
                {(description || action) && (
                    <div className="flex min-h-8 flex-col gap-3 py-1 sm:flex-row sm:items-center sm:justify-between">
                        {description && (
                            <p className="text-muted-foreground text-sm">{description}</p>
                        )}
                        {/* action 容器始终渲染并占满按钮高度，无内容时保持占位防抖动 */}
                        <div className="flex h-8 items-center gap-2 empty:hidden">{action}</div>
                    </div>
                )}
                {/* sticky 额外内容：表格工具栏、筛选器等 */}
                {sticky}
            </div>
            {/* 页面内容 */}
            {children}
        </div>
    );
}
