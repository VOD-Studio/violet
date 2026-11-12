"use client";

import { cn } from "cn";
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../tooltip";

interface CellWithTooltipProps {
	children: ReactNode;
	/** 提供即开启提示并始终显示；省略号截断且未提供时用内容文本兜底，只在确实被截断时出现 */
	tooltip?: string;
	/** 单行省略号截断 */
	ellipsis?: boolean;
	/** 提示的挂载容器，默认 body */
	container?: HTMLElement | null;
}

const TRUNCATE_CLASS = "v-table__truncate";

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

/** 把子节点变成承担截断的元素，同时它也是提示的触发器：文本包 span，单一元素追加截断类，其余外包 span。 */
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

/** 单元格内容加悬停提示；调用方需在 `TooltipProvider` 之下。 */
export function CellWithTooltip({ children, tooltip, ellipsis, container }: CellWithTooltipProps) {
	const tip = tooltip ?? (ellipsis ? extractText(children) : undefined);
	if (tip == null || tip === "") return ellipsis ? toTruncatingElement(children) : children;

	if (!ellipsis) {
		return (
			<Tooltip>
				<TooltipTrigger asChild>
					<span className="v-table__tip-target">{children}</span>
				</TooltipTrigger>
				<TooltipContent side="top" align="center" container={container}>
					{tip}
				</TooltipContent>
			</Tooltip>
		);
	}

	return (
		<Tooltip truncatedOnly={tooltip == null}>
			<TooltipTrigger asChild>{toTruncatingElement(children)}</TooltipTrigger>
			<TooltipContent side="top" align="center" container={container}>
				{tip}
			</TooltipContent>
		</Tooltip>
	);
}
