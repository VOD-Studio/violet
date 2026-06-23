import { cn } from "@shared/lib/utils";
import * as React from "react";

export interface ScrollAreaProps
	extends React.HTMLAttributes<HTMLDivElement> {
	/** 遮罩方向，默认上下渐隐 */
	mask?: "y" | "none";
}

/**
 * ScrollArea - 带渐隐遮罩的滚动容器
 *
 * spec：列表上下滚动带线性渐隐遮罩，卡片从暗影中浮现与消散。
 * .scroll-mask-y 由 styles.css 提供 mask-image。
 *
 * 不依赖 Radix ScrollArea（避免引入额外滚动条样式冲突），原生 overflow。
 */
const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
	({ className, children, mask = "y", ...props }, ref) => {
		return (
			<div
				ref={ref}
				className={cn(
					"overflow-y-auto",
					mask === "y" && "scroll-mask-y",
					className,
				)}
				{...props}
			>
				{children}
			</div>
		);
	},
);
ScrollArea.displayName = "ScrollArea";

export { ScrollArea };
