import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

interface ModalBodyProps {
    /** 内容 */
    children?: ReactNode;
    /** 是否自动滚动，默认 true。false 时为 overflow-hidden，由 children 自管滚动 */
    scrollable?: boolean;
    /** 额外 className */
    className?: string;
}

/**
 * ModalBody - Modal 可滚动内容区（三段式布局的中段）
 *
 * flex-1 占满剩余高度，min-h-0 允许收缩（滚动必需）。
 * - scrollable=true（默认）：纵向自动滚动，header/footer 固定。
 * - scrollable=false：overflow-hidden，由 children（如 Tabs）自管滚动。
 */
export function ModalBody({ children, scrollable = true, className }: ModalBodyProps) {
    return (
        <div
            className={cn(
                "min-h-0 flex-1 px-6 py-4",
                scrollable ? "overflow-y-auto" : "overflow-hidden",
                className,
            )}
        >
            {children}
        </div>
    );
}
