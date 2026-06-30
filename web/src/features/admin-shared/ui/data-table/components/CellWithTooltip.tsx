import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

interface CellWithTooltipProps {
    /** 单元格内容 */
    children: ReactNode;
    /** tooltip 文本，提供即开启；省略号截断时自动用 children 文本兜底 */
    tooltip?: string;
    /** 开启省略号截断 */
    ellipsis?: boolean;
}

/**
 * CellWithTooltip - 单元格内容 + 悬停 tooltip
 *
 * ellipsis 开启时内容单行截断，悬停显示 tooltip（优先用 tooltip 文案，
 * 缺省回退 children 的字符串形式）。
 *
 * tooltip 内容通过 Portal 渲染到 body，显式指定 side/sideOffset/align，
 * 避免在固定列/滚动容器内因定位上下文导致提示框错位到屏幕左上角。
 */
export function CellWithTooltip({ children, tooltip, ellipsis }: CellWithTooltipProps) {
    const tip = tooltip ?? (typeof children === "string" ? children : undefined);

    if (!tip) {
        return ellipsis ? <span className="block truncate">{children}</span> : children;
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span
                    className={
                        ellipsis
                            ? "block w-full cursor-default truncate text-left"
                            : "inline cursor-default"
                    }
                >
                    {children}
                </span>
            </TooltipTrigger>
            <TooltipContent side="top" align="center" sideOffset={6}>
                {tip}
            </TooltipContent>
        </Tooltip>
    );
}
