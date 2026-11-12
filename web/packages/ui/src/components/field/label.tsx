"use client";

import { cn } from "cn";
import { Slot } from "radix-ui";
import type * as React from "react";

/**
 * 原生 label 属性，htmlFor 必须指向对应控件；保留 Radix asChild 组合入口。
 */
export interface LabelProps extends React.ComponentProps<"label"> {
	asChild?: boolean;
}

/**
 * 提供可访问名称的 label；点击聚焦由浏览器处理。
 */
export function Label({ className, asChild = false, ...props }: LabelProps) {
	const Component = asChild ? Slot.Root : "label";
	return <Component {...props} data-slot="label" className={cn("v-label", className)} />;
}
