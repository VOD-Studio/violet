import { Tooltip, TooltipContent, TooltipTrigger } from "@violet/ui";
import { cn } from "cn";
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

interface CellWithTooltipProps {
	/** 单元格内容 */
	children: ReactNode;
	/** tooltip 文本，提供即开启；省略号截断时自动用 children 文本兜底 */
	tooltip?: string;
	/** 开启省略号截断 */
	ellipsis?: boolean;
}

const TRUNCATE_CLASS = "block min-w-0 max-w-full truncate";

/**
 * 从 React 节点中递归提取纯文本，用于无显式 tooltip 时的省略号兜底提示。
 */
function extractText(node: ReactNode): string {
	if (node == null) return "";
	if (typeof node === "string" || typeof node === "number") return String(node);
	if (Array.isArray(node)) return node.map(extractText).join("");
	if (isValidElement(node)) {
		const element = node as ReactElement<{ children?: ReactNode }>;
		return extractText(element.props.children);
	}
	return "";
}

/**
 * 把子节点变成承担截断的那个元素，作为提示的触发器：
 * - 文本/数字：包入截断 span
 * - 单一 React 元素：追加截断类名
 * - 其他：外层 span 兜底截断
 */
function toTruncatingElement(child: ReactNode): ReactElement<{ className?: string }> {
	if (typeof child === "string" || typeof child === "number") {
		return <span className={TRUNCATE_CLASS}>{child}</span>;
	}
	const only = Children.count(child) === 1 ? Children.toArray(child)[0] : null;
	if (isValidElement(only)) {
		const element = only as ReactElement<{ className?: string }>;
		return cloneElement(element, { className: cn(element.props.className, TRUNCATE_CLASS) });
	}
	return <span className={TRUNCATE_CLASS}>{child}</span>;
}

/**
 * CellWithTooltip - 单元格内容 + 悬停 tooltip
 *
 * ellipsis 开启时内容单行截断：显式提供 tooltip 时始终提示；未提供时用内容文本，
 * 且只有文字确实被截断才出现，避免已完整展示仍弹提示。
 */
export function CellWithTooltip({ children, tooltip, ellipsis }: CellWithTooltipProps) {
	const tip = tooltip ?? (ellipsis ? extractText(children) : undefined);
	if (tip == null || tip === "") return ellipsis ? toTruncatingElement(children) : children;

	if (!ellipsis) {
		return (
			<Tooltip>
				<TooltipTrigger asChild>
					<span className="inline cursor-default">{children}</span>
				</TooltipTrigger>
				<TooltipContent side="top" align="center">
					{tip}
				</TooltipContent>
			</Tooltip>
		);
	}

	return (
		<Tooltip truncatedOnly={tooltip == null}>
			<TooltipTrigger asChild>{toTruncatingElement(children)}</TooltipTrigger>
			<TooltipContent side="top" align="center">
				{tip}
			</TooltipContent>
		</Tooltip>
	);
}
