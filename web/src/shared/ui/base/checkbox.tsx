import { cva, type VariantProps } from "class-variance-authority";
import { Check, Minus } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "cn";

/**
 * 复选框样式变体。
 *
 * 采用 Violet 语义 Token 与静穆实体层级：
 * - 选中/半选态带顶边微光倒角（bevel highlight）增强物理材质感；
 * - 激活态采用光学吸收沉浸感，严禁任何 scale 缩放变形或空间位移；
 * - 纯 CSS 响应 checked 与 indeterminate 三态，平滑淡入图标；
 * - 焦点环与全站规范对齐，无障碍键盘导航完整继承 Radix WAI-ARIA。
 */
const checkboxVariants = cva(
	"group peer relative shrink-0 select-none border outline-none transition-[color,background-color,border-color,box-shadow,opacity,filter] duration-150 ease-out cursor-pointer focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-40 disabled:pointer-events-none aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 active:brightness-95",
	{
		variants: {
			variant: {
				default:
					"border-foreground/30 bg-card text-primary-foreground shadow-xs hover:border-foreground/50 hover:bg-accent/40 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2),0_1px_2px_rgba(0,0,0,0.06)] data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2),0_1px_2px_rgba(0,0,0,0.06)] dark:border-foreground/40 dark:bg-card/40 dark:hover:border-foreground/60 dark:hover:bg-accent/30 dark:data-[state=checked]:border-primary dark:data-[state=checked]:bg-primary dark:data-[state=indeterminate]:border-primary dark:data-[state=indeterminate]:bg-primary",
				brand:
					"border-brand/40 bg-card text-brand-foreground shadow-xs hover:border-brand/70 hover:bg-brand-wash/30 data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=checked]:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25),0_1px_2px_color-mix(in_oklch,var(--color-brand,#7c3aed)_25%,transparent)] data-[state=indeterminate]:border-brand data-[state=indeterminate]:bg-brand data-[state=indeterminate]:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25),0_1px_2px_color-mix(in_oklch,var(--color-brand,#7c3aed)_25%,transparent)] dark:border-brand/50 dark:bg-card/40 dark:hover:border-brand/80 dark:data-[state=checked]:border-brand dark:data-[state=checked]:bg-brand dark:data-[state=indeterminate]:border-brand dark:data-[state=indeterminate]:bg-brand",
			},
			size: {
				sm: "size-3.5 rounded-[4px]",
				default: "size-4 rounded-[5px]",
				lg: "size-5 rounded-md",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

export interface CheckboxProps
	extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>,
		VariantProps<typeof checkboxVariants> {}

/**
 * Violet 通用复选框组件。
 *
 * 遵循 WAI-ARIA Checkbox 规范，原生支持 checked、unchecked 与 indeterminate 三态。
 */
function Checkbox({
	className,
	variant = "default",
	size = "default",
	...props
}: CheckboxProps) {
	return (
		<CheckboxPrimitive.Root
			data-slot="checkbox"
			data-variant={variant}
			data-size={size}
			className={cn(checkboxVariants({ variant, size, className }))}
			{...props}
		>
			<CheckboxPrimitive.Indicator
				data-slot="checkbox-indicator"
				className="flex size-full items-center justify-center text-current pointer-events-none"
			>
				<Check
					aria-hidden="true"
					className="size-3.5 stroke-[2.5] group-data-[size=sm]:size-2.5 group-data-[size=default]:size-3.5 group-data-[size=lg]:size-4 group-data-[state=indeterminate]:hidden animate-in fade-in-0 duration-150"
				/>
				<Minus
					aria-hidden="true"
					className="hidden size-3.5 stroke-[2.5] group-data-[size=sm]:size-2.5 group-data-[size=default]:size-3.5 group-data-[size=lg]:size-4 group-data-[state=indeterminate]:block animate-in fade-in-0 duration-150"
				/>
			</CheckboxPrimitive.Indicator>
		</CheckboxPrimitive.Root>
	);
}

export { Checkbox, checkboxVariants };
