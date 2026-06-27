import type { ReactNode } from "react";

interface PageShellProps {
    /** 页面主标题（h1，唯一来源，由 shell 渲染） - 注意：TopBar 已显示标题，此处不再渲染 */
    title: string;
    /** 副标题描述 */
    description?: string;
    /** 标题区右侧操作（如「创建分组」按钮） */
    action?: ReactNode;
    /** 页面主体内容 */
    children: ReactNode;
}

/**
 * PageShell - 后台页面内容壳
 *
 * 统一后台页面的副标题、操作区与内容区间距。
 * 注意：页面主标题 (h1) 已由 TopBar 渲染，此组件不再重复显示。
 */
export function PageShell({ description, action, children }: PageShellProps) {
    // 如果既没有 description 也没有 action，直接渲染 children
    if (!description && !action) {
        return <div>{children}</div>;
    }

    return (
        <div className="space-y-6">
            {/* 副标题和操作区 */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {description && (
                    <p className="text-muted-foreground text-sm">{description}</p>
                )}
                {action && <div className="flex items-center gap-2">{action}</div>}
            </div>
            {/* 页面内容 */}
            {children}
        </div>
    );
}
