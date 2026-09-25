import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "cn";

/**
 * 按钮样式变体定义。
 *
 * 采用 Violet 语义 Token 与静穆实体物理层级：
 * - 顶边细微内高光（bevel highlight）增强物理材质感，深浅域自然呈现；
 * - 底部微接触阴影提供层次感，严禁违规硬投影与粗糙描边；
 * - 激活态采用光学吸收沉浸感（brightness 吸收与内光收敛），彻底杜绝位移颤抖（translate-y）与缩放（scale）；
 * - 各规格固定内边距，移除 has-[>svg] 动态跳变，配合绝对定位占位保证零布局抖动（0 CLS）；
 * - 焦点环基于 --ring 语义 Token 实现高对比度轮廓。
 */
const buttonVariants = cva(
	"relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-[color,background-color,border-color,box-shadow,opacity,filter] duration-150 ease-out outline-none cursor-pointer focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
	{
		variants: {
			variant: {
				default:
					"border border-primary/20 bg-primary text-primary-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18),0_1px_2px_0_rgba(0,0,0,0.06)] hover:bg-primary/90 hover:border-primary/40 active:brightness-[0.92] dark:active:brightness-110 active:shadow-[inset_0_1px_1px_rgba(0,0,0,0.15)]",
				brand:
					"border border-brand-hover/30 bg-brand text-brand-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22),0_1px_2px_0_color-mix(in_oklch,var(--color-brand,#7c3aed)_25%,transparent)] hover:bg-brand-hover hover:border-brand-hover/50 active:brightness-[0.92] dark:active:brightness-110 active:shadow-[inset_0_1px_1px_rgba(0,0,0,0.2)]",
				secondary:
					"border border-border/60 bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80 hover:border-border active:bg-secondary/90 active:brightness-95 dark:border-border/40",
				soft:
					"border border-brand/20 bg-brand-wash text-brand-wash-foreground shadow-xs hover:bg-brand-wash/80 hover:border-brand/40 active:bg-brand-wash/90 active:border-brand/30",
				outline:
					"border border-border/80 bg-background/90 text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground hover:border-foreground/20 active:bg-accent active:text-accent-foreground dark:border-input dark:bg-card/40 dark:hover:bg-input/50 dark:hover:border-input",
				ghost:
					"text-foreground/85 hover:bg-accent/80 hover:text-foreground active:bg-accent/90 active:text-foreground dark:hover:bg-accent/50",
				link:
					"h-auto p-0 text-primary underline-offset-4 hover:underline hover:text-primary/90 active:opacity-75",
				destructive:
					"border border-destructive/30 bg-destructive text-destructive-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18),0_1px_2px_0_rgba(0,0,0,0.08)] hover:bg-destructive/90 hover:border-destructive/50 active:brightness-[0.92] dark:active:brightness-110 active:shadow-[inset_0_1px_1px_rgba(0,0,0,0.2)] focus-visible:ring-destructive/30 dark:bg-destructive/70 dark:focus-visible:ring-destructive/40",
			},
			size: {
				default: "h-9 px-4 text-sm",
				xs: "h-6 px-2 text-xs rounded-md gap-1 [&_svg:not([class*='size-'])]:size-3",
				sm: "h-8 px-3 text-xs rounded-lg gap-1.5 [&_svg:not([class*='size-'])]:size-3.5",
				lg: "h-10 px-5 text-sm rounded-lg gap-2 [&_svg:not([class*='size-'])]:size-4.5",
				xl: "h-11 px-6 text-base rounded-xl gap-2.5 [&_svg:not([class*='size-'])]:size-5",
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
	/** 是否处于加载处理中状态（自动禁用并平滑展开加载指示器，正文持续留存） */
	loading?: boolean;
	/** 加载状态提示文案，提供时替换正文，不提供时保留正文文案并在前置位平滑显现指示器 */
	loadingText?: React.ReactNode;
	/** 按钮前置图标插槽 */
	leftIcon?: React.ReactNode;
	/** 按钮后置图标插槽 */
	rightIcon?: React.ReactNode;
}

/**
 * Violet 通用按钮组件。
 *
 * 规范：
 * - 纯图标按钮（size 为 icon-*）必须显式配置 aria-label；
 * - 激活触感为纯光学明度吸收，杜绝 scale 或 translate-y 空间位移与颤抖；
 * - loading 状态下正文保持在场，指示器平滑展开或原位淡入淡出，杜绝突兀跳变。
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

	const isIconOnly = typeof size === "string" && size.startsWith("icon");
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
			{isIconOnly ? (
				/* 纯图标按钮：图标与 spinner 原位平滑替换，尺寸恒定 */
				<span className="relative inline-flex items-center justify-center">
					{loading ? (
						<span
							aria-hidden="true"
							className="inline-flex items-center justify-center animate-in fade-in-0 duration-200"
						>
							<Loader2 className="animate-spin text-current" />
						</span>
					) : (
						children
					)}
				</span>
			) : leftIcon ? (
				/* 存在前置图标：spinner 与 leftIcon 原位无缝替换，按钮宽度毫发无损 */
				<span className="relative inline-flex items-center justify-center shrink-0">
					{loading ? (
						<span
							aria-hidden="true"
							className="inline-flex items-center justify-center animate-in fade-in-0 duration-200"
						>
							<Loader2 className="animate-spin text-current" />
						</span>
					) : (
						leftIcon
					)}
				</span>
			) : (
				/* 无前置图标：spinner 沿水平方向以 0fr -> 1fr 丝滑展开，文字稳定在场留存 */
				<span
					aria-hidden="true"
					className={cn(
						"inline-grid transition-[grid-template-columns,margin-right,opacity] duration-200 ease-out",
						loading
							? "grid-cols-[1fr] mr-0 opacity-100"
							: "grid-cols-[0fr] -mr-2 opacity-0 pointer-events-none",
					)}
				>
					<span className="overflow-hidden inline-flex items-center justify-center">
						{loading && <Loader2 className="animate-spin text-current shrink-0" />}
					</span>
				</span>
			)}

			{/* 正文插槽：纯图标除外，文字永远在场留存，支持可选 loadingText 覆盖 */}
			{!isIconOnly && (
				<span className="inline-flex items-center transition-opacity duration-200">
					{loading && loadingText ? loadingText : children}
				</span>
			)}

			{/* 后置图标 */}
			{!isIconOnly && rightIcon && (
				<span
					className={cn(
						"inline-flex items-center justify-center transition-opacity duration-200",
						loading ? "opacity-40" : "opacity-100",
					)}
				>
					{rightIcon}
				</span>
			)}
		</button>
	);
}

export { Button, buttonVariants };
