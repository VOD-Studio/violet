import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type * as React from "react";

export const badgeVariants = cva(
	"inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-full border border-transparent font-medium whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3",
	{
		variants: {
			variant: {
				default: "bg-primary text-primary-foreground",
				secondary: "bg-secondary text-secondary-foreground",
				destructive: "bg-destructive text-destructive-foreground dark:text-background",
				outline: "border-border text-foreground",
				ghost: "text-foreground",
				link: "text-primary underline underline-offset-4",
			},
			size: {
				default: "px-2 py-0.5 text-xs",
				count: "min-w-4 h-4 px-1 text-[10px] leading-none tabular-nums",
				dot: "size-2.5 p-0",
			},
		},
		compoundVariants: [{ variant: "link", size: "default", class: "px-0" }],
		defaultVariants: { variant: "default", size: "default" },
	},
);

/**
 * 用语义色展示简短状态；count 与 dot 仅控制尺寸，不负责定位或截断计数。
 */
export type BadgeProps = React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

/** 展示状态文字、计数或圆点，不承担触发器的交互语义。 */
export function Badge({
	className,
	variant = "default",
	size = "default",
	children,
	...props
}: BadgeProps) {
	return (
		<span
			data-slot="badge"
			data-variant={variant}
			data-size={size}
			className={cn(badgeVariants({ variant, size }), className)}
			{...props}
		>
			{size === "dot" ? null : children}
		</span>
	);
}

/**
 * 将装饰性角标置于触发器右上角，保留子节点原有的 DOM、焦点与点击行为。
 */
export interface BadgeAnchorProps extends React.ComponentProps<"span"> {
	badge?: React.ReactNode;
	/** corner 外置数量胶囊；edge 让小圆点贴住按钮边缘。 */
	placement?: "corner" | "edge";
	children: React.ReactNode;
}

export function BadgeAnchor({
	badge,
	placement = "corner",
	children,
	className,
	...props
}: BadgeAnchorProps) {
	return (
		<span
			data-slot="badge-anchor"
			className={cn("relative inline-flex shrink-0", className)}
			{...props}
		>
			{children}
			{badge != null && (
				<span
					className={cn(
						"pointer-events-none absolute flex",
						placement === "corner"
							? "top-0.5 right-0.75 translate-x-1/2 -translate-y-1/2"
							: "top-0 right-0",
					)}
					aria-hidden="true"
				>
					{badge}
				</span>
			)}
		</span>
	);
}
