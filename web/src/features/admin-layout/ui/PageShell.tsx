import type { ReactNode } from "react";

interface PageShellProps {
    /** 页面主标题（h1，唯一来源，由 shell 渲染） */
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
 * 统一三个后台页面的标题层级（h1）、副标题、操作区与内容区间距。
 * 消除原来 h1/h2 混用、padding/space 不一致的问题。
 */
export function PageShell({ title, description, action, children }: PageShellProps) {
    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                    {description && <p className="text-muted-foreground text-sm">{description}</p>}
                </div>
                {action && <div className="flex items-center gap-2">{action}</div>}
            </div>
            {children}
        </div>
    );
}
