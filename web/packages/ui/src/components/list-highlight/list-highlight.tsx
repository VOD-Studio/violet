"use client";

import { cn } from "cn";
import { Slot } from "radix-ui";
import { useComposedRefs } from "radix-ui/internal";
import type { HTMLAttributes, ReactElement, Ref } from "react";
import { type ListHighlightMode, useListHighlight } from "./use-list-highlight";

export type { ListHighlightMode } from "./use-list-highlight";

/** 不增加 DOM 层级；子元素必须透传原生属性与 ref，容器的 ::before 留给高亮层。 */
export interface ListHighlightProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
	children: ReactElement;
	ref?: Ref<HTMLElement>;
	/** pointer 跟随悬停与键盘焦点；focus 跟随实际焦点；active 只跟随条目的 active。 */
	mode?: ListHighlightMode;
}

/** 共用一块底色跟随列表当前项，不接管选值、点击、焦点或键盘导航。 */
export function ListHighlight({
	children,
	mode = "pointer",
	className,
	ref,
	...props
}: ListHighlightProps) {
	const highlight = useListHighlight({ mode });
	const composedRef = useComposedRefs(ref, highlight.ref);
	return (
		<Slot.Root
			{...props}
			ref={composedRef}
			className={cn("v-list-highlight", className)}
			data-list-highlight=""
		>
			{children}
		</Slot.Root>
	);
}

/** 子元素保留自己的原生语义、属性、事件与 ref；active 由列表宿主持有。 */
export interface ListHighlightItemProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
	children: ReactElement;
	ref?: Ref<HTMLElement>;
	active?: boolean;
}

/** 标记可跟随的条目；不额外渲染包裹元素。 */
export function ListHighlightItem({
	children,
	active,
	className,
	...props
}: ListHighlightItemProps) {
	return (
		<Slot.Root
			{...props}
			className={cn("v-list-highlight__item", className)}
			data-list-highlight-item=""
			data-list-highlight-active={active || undefined}
		>
			{children}
		</Slot.Root>
	);
}
