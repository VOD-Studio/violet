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
 * 关键点：trigger 锚点要落在"文字本身"上，而非整个单元格——
 * 因此 ellipsis 模式下用两层结构：外层 block+truncate 负责占满单元格并截断，
 * 内层 inline span 紧贴文字作为 TooltipTrigger，tooltip 即以文字为锚定位。
 */
export function CellWithTooltip({ children, tooltip, ellipsis }: CellWithTooltipProps) {
    const tip = tooltip ?? (typeof children === "string" ? children : undefined);

    if (!tip) {
        return ellipsis ? <span className="block truncate">{children}</span> : children;
    }

    // ellipsis：外层负责截断布局，内层 inline span 作为锚点
    if (ellipsis) {
        return (
            <span className="block truncate">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span className="inline cursor-default align-bottom">{children}</span>
                    </TooltipTrigger>
                    <TooltipContent side="top" align="center" sideOffset={6}>
                        {tip}
                    </TooltipContent>
                </Tooltip>
            </span>
        );
    }

    // 非 ellipsis：直接 inline 包裹
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span className="inline cursor-default">{children}</span>
            </TooltipTrigger>
            <TooltipContent side="top" align="center" sideOffset={6}>
                {tip}
            </TooltipContent>
        </Tooltip>
    );
}
