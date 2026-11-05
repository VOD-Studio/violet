"use client";

import { X } from "lucide-react";
import { Slot, Toggle } from "radix-ui";
import type { ComponentProps, HTMLAttributes, MouseEvent, ReactNode, Ref } from "react";
import { type TagVariantProps, tagVariants } from "./styles";

/** 取出 children 里的纯文字；JSX 会把 `#{name}` 拆成数组，元素节点不参与。 */
function textOf(node: ReactNode): string {
	if (typeof node === "string" || typeof node === "number") return String(node);
	if (Array.isArray(node)) return node.map(textOf).join("");
	return "";
}

interface NativeTagProps extends ComponentProps<"span">, TagVariantProps {
	asChild?: false;
	/** 12px，在文字前；对读屏隐藏。 */
	icon?: ReactNode;
	/** 提供后在末尾渲染独立的 × 按钮；点击不会冒泡到标签的祖先。 */
	onRemove?: () => void;
	/** × 的可访问名称；默认「移除 文字」，children 不是文字时为「移除」。 */
	removeLabel?: string;
}

interface AsChildTagProps extends HTMLAttributes<HTMLElement>, TagVariantProps {
	/** 把属性与 ref 合并到唯一子元素（如 `<a href>`）；图标与移除按钮需自行放进子元素。 */
	asChild: true;
	ref?: Ref<HTMLElement>;
	icon?: never;
	onRemove?: never;
	removeLabel?: never;
}

/** 原生模式的 ref 指向 span；asChild 模式指向子元素。 */
export type TagProps = NativeTagProps | AsChildTagProps;

/**
 * 给内容分类的药丸标签。可移除的 × 是独立按钮；链接标签用 asChild 包裹 `<a>`。
 */
export function Tag({
	size = "md",
	tone = "neutral",
	asChild,
	icon,
	onRemove,
	removeLabel,
	className,
	children,
	ref,
	...props
}: TagProps) {
	const classes = tagVariants({ size, tone, className });
	if (asChild) {
		return (
			<Slot.Root data-slot="tag" {...props} ref={ref} className={classes}>
				{children}
			</Slot.Root>
		);
	}

	const text = textOf(children);
	const label = removeLabel ?? (text ? `移除 ${text}` : "移除");
	const remove = (event: MouseEvent<HTMLButtonElement>) => {
		// 标签可能位于可点击的容器或 label 内，× 只负责移除
		event.preventDefault();
		event.stopPropagation();
		onRemove?.();
	};
	return (
		<span
			data-slot="tag"
			{...props}
			ref={ref as Ref<HTMLSpanElement> | undefined}
			className={classes}
			data-removable={onRemove ? "true" : undefined}
		>
			{icon != null && (
				<span className="v-tag__icon" aria-hidden="true">
					{icon}
				</span>
			)}
			{children}
			{onRemove && (
				<button type="button" className="v-tag__remove" aria-label={label} onClick={remove}>
					<X size={12} aria-hidden="true" />
				</button>
			)}
		</span>
	);
}

/** 受控与非受控状态沿用 Radix Toggle；互斥或多选关系由调用方用 pressed 组合，并在外层写 `role="group"` 与名称。 */
export interface TagToggleProps
	extends Omit<ComponentProps<typeof Toggle.Root>, "asChild">,
		Omit<TagVariantProps, "tone"> {
	icon?: ReactNode;
}

/**
 * 可选中的筛选标签：原生 button 加 `aria-pressed`，选中时换成强调色外观。
 */
export function TagToggle({ size = "md", icon, className, children, ...props }: TagToggleProps) {
	return (
		<Toggle.Root
			data-slot="tag-toggle"
			{...props}
			className={tagVariants({ size, toggle: true, className })}
		>
			{icon != null && (
				<span className="v-tag__icon" aria-hidden="true">
					{icon}
				</span>
			)}
			{children}
		</Toggle.Root>
	);
}
