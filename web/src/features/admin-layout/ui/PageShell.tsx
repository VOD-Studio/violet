import { type ReactNode, useEffect, useRef, useState } from "react";

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
    const elRef = useRef<HTMLDivElement>(null);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const pEl = elRef.current?.parentElement;
        if (!pEl) return;
        const handleScroll = () => setScrolled(pEl.scrollTop > 8);
        handleScroll();
        pEl.addEventListener("scroll", handleScroll);
        return () => pEl.removeEventListener("scroll", handleScroll);
    }, []);

    // 既无描述也无操作且无 sticky 内容时,直接渲染内容(无标题区,不占额外空间)
    // 内边距与正常路径内容区一致(px-4 md:px-6):自内边距职责从 <main> 移入
    // PageShell 后,此分支是页面唯一的内边距来源,缺失会导致内容紧贴边缘。
    // 注意:early return 必须在所有 hooks 之后,否则违反 React Hooks 规则。
    if (!description && !action && !sticky) {
        return <div className="px-4 pt-4 pb-6 md:px-6">{children}</div>;
    }

    return (
        <div className="space-y-2 pb-6" ref={elRef}>
            {/*
             * sticky top-0：粘性定位，滚动到顶部后自动固定。
             * z-10 + children 用 isolate 建独立层叠上下文，DataTable 内部 z-30~z-50 被困在其中，
             * 不会穿透到 sticky header 之上；弹窗（z-50 body 级）也不受影响。
             * bg-background 100% 不透明。
             */}
            <div
                className={`sticky top-0 z-10 bg-background px-4 md:px-6 pt-4 pb-4 ${scrolled ? "border-b border-edge-hairline bg-background shadow-lg" : ""}`}
            >
                {/* 副标题和操作区：固定高度避免有无按钮时抖动 */}
                {(description || action) && (
                    <div className="flex min-h-8 flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                        {description && (
                            <p className="text-muted-foreground text-sm">{description}</p>
                        )}
                        <div className="flex h-8 items-center gap-2 empty:hidden">{action}</div>
                    </div>
                )}
                {/* sticky 额外内容：表格工具栏、筛选器等 */}
                {sticky}
            </div>
            {/* isolate 包裹内容区：困住 DataTable 固定列的 z-index，防止穿透 sticky header */}
            <div className="relative isolate space-y-6 px-4 md:px-6">{children}</div>
        </div>
    );
}
