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
 */
export function CellWithTooltip({ children, tooltip, ellipsis }: CellWithTooltipProps) {
	const tip = tooltip ?? (typeof children === "string" ? children : undefined);
	const content = ellipsis ? <span className="block truncate">{children}</span> : children;

	if (!tip) return content;

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span className={ellipsis ? "block cursor-default truncate" : "inline cursor-default"}>
					{children}
				</span>
			</TooltipTrigger>
			<TooltipContent>{tip}</TooltipContent>
		</Tooltip>
	);
}
