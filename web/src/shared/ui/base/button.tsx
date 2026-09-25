import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "@/shared/lib/utils";

/**
 * 按钮样式变体定义。
 *
 * 采用 Violet 语义 Token 与精工微光物理层级：
 * - 顶边细微内高光（bevel highlight）增强物理实体感，暗域自适应；
 * - 底部微接触阴影提供自然浮起，无违规硬投影；
 * - 激活态采用物理微沉（translate-y-px），严格杜绝 scale 缩放变形；
 * - 焦点环基于 --ring 语义 Token 实现高对比度无遮挡轮廓。
 */
const buttonVariants = cva(
	"relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 ease-out outline-none cursor-pointer focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background active:translate-y-px disabled:pointer-events-none disabled:opacity-50 disabled:active:translate-y-0 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
	{
		variants: {
			variant: {
				default:
					"border border-primary/20 bg-primary text-primary-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18),0_1px_2px_0_rgba(0,0,0,0.06)] hover:bg-primary/90 hover:border-primary/40 active:shadow-[inset_0_1px_2px_0_rgba(0,0,0,0.2)]",
				brand:
					"border border-brand-hover/30 bg-brand text-brand-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22),0_1px_2px_0_color-mix(in_oklch,var(--color-brand,#7c3aed)_25%,transparent)] hover:bg-brand-hover hover:border-brand-hover/50 active:shadow-[inset_0_1px_2px_0_rgba(0,0,0,0.25)]",
				secondary:
					"border border-border/60 bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80 hover:border-border active:shadow-none dark:border-border/40",
				soft:
					"border border-brand/20 bg-brand-wash text-brand-wash-foreground shadow-xs hover:bg-brand-wash/80 hover:border-brand/40 active:shadow-none",
				outline:
					"border border-border/80 bg-background/90 text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground hover:border-foreground/20 active:shadow-none dark:border-input dark:bg-card/40 dark:hover:bg-input/50 dark:hover:border-input",
				ghost:
					"text-foreground/85 hover:bg-accent/80 hover:text-foreground active:bg-accent active:translate-y-px dark:hover:bg-accent/50",
				link:
					"h-auto p-0 text-primary underline-offset-4 hover:underline hover:text-primary/90 active:translate-y-0",
				destructive:
					"border border-destructive/30 bg-destructive text-destructive-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18),0_1px_2px_0_rgba(0,0,0,0.08)] hover:bg-destructive/90 hover:border-destructive/50 active:shadow-[inset_0_1px_2px_0_rgba(0,0,0,0.2)] focus-visible:ring-destructive/30 dark:bg-destructive/70 dark:focus-visible:ring-destructive/40",
			},
			size: {
				default: "h-9 px-4 py-2 has-[>svg]:px-3",
				xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
				sm: "h-8 gap-1.5 rounded-lg px-3 text-xs has-[>svg]:px-2.5 [&_svg:not([class*='size-'])]:size-3.5",
				lg: "h-10 gap-2 rounded-lg px-5 text-sm has-[>svg]:px-3.5 [&_svg:not([class*='size-'])]:size-4.5",
				xl: "h-11 gap-2.5 rounded-xl px-6 text-base has-[>svg]:px-4 [&_svg:not([class*='size-'])]:size-5",
				icon: "size-9 p-0",
				"icon-xs": "size-6 rounded-md p-0 [&_svg:not([class*='size-'])]:size-3",
				"icon-sm": "size-8 rounded-lg p-0 [&_svg:not([class*='size-'])]:size-3.5",
				"icon-lg": "size-10 rounded-lg p-0 [&_svg:not([class*='size-'])]:size-5",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

export interface ButtonProps
	extends React.ComponentProps<"button">,
		VariantProps<typeof buttonVariants> {
	/** 是否将属性直接注入单子元素（基于 Radix Slot） */
	asChild?: boolean;
	/** 是否处于加载处理中状态（自动置灰并展示平滑旋转指示器） */
	loading?: boolean;
	/** 加载状态提示文案，提供时替换正文，省略时保留正文并在前置位展示旋转指示器 */
	loadingText?: React.ReactNode;
	/** 按钮前置图标插槽，处于加载态时将平滑替换为加载指示器以杜绝布局抖动 */
	leftIcon?: React.ReactNode;
	/** 按钮后置图标插槽 */
	rightIcon?: React.ReactNode;
}

/**
 * Violet 通用按钮组件。
 *
 * 规范：
 * - 纯图标按钮（size 为 icon-*）必须显式配置 aria-label；
 * - 主要操作使用 default 或 brand，次要操作降级为 secondary/outline/ghost；
 * - 支持 loading 内置指示与无缝平滑替换，彻底消除页面抖动。
 */
function Button({
	className,
	variant = "default",
	size = "default",
	asChild = false,
	loading = false,
	loadingText,
	leftIcon,
	rightIcon,
	disabled,
	type = "button",
	children,
	...props
}: ButtonProps) {
	if (asChild) {
		return (
			<Slot.Root
				data-slot="button"
				data-variant={variant}
				data-size={size}
				className={cn(buttonVariants({ variant, size, className }))}
				{...props}
			>
				{children}
			</Slot.Root>
		);
	}

	const isIconSize = typeof size === "string" && size.startsWith("icon");
	const isDisabled = disabled || loading;

	return (
		<button
			type={type}
			data-slot="button"
			data-variant={variant}
			data-size={size}
			data-loading={loading ? "true" : undefined}
			aria-busy={loading || undefined}
			disabled={isDisabled}
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		>
			{loading ? (
				<Loader2 aria-hidden="true" className="animate-spin text-current" />
			) : (
				leftIcon
			)}
			{loading && loadingText ? (
				<span>{loadingText}</span>
			) : loading && isIconSize ? null : (
				children
			)}
			{!loading && rightIcon}
		</button>
	);
}

export { Button, buttonVariants };
