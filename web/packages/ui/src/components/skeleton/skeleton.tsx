import { cn } from "cn";
import type * as React from "react";

/** 加载占位块；尺寸与形状由调用方的 className 决定，默认对读屏隐藏（忙碌状态由所在区域的 `aria-busy` 表达）。 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			aria-hidden="true"
			data-slot="skeleton"
			className={cn("v-skeleton", className)}
			{...props}
		/>
	);
}

export { Skeleton };
