import { Check, Minus } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import type * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";

const checkboxVariants = tv({
	base: "group peer relative shrink-0 select-none border outline-none transition-[color,background-color,border-color,box-shadow,opacity,filter] duration-150 ease-out cursor-pointer focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-40 disabled:pointer-events-none aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 active:brightness-95",
	variants: {
		variant: {
			default:
				"border-foreground/30 bg-card text-primary-foreground shadow-xs hover:border-foreground/50 hover:bg-accent/40 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2),0_1px_2px_rgba(0,0,0,0.06)] data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2),0_1px_2px_rgba(0,0,0,0.06)] dark:border-foreground/40 dark:bg-card/40 dark:hover:border-foreground/60 dark:hover:bg-accent/30 dark:data-[state=checked]:border-primary dark:data-[state=checked]:bg-primary dark:data-[state=indeterminate]:border-primary dark:data-[state=indeterminate]:bg-primary",
			primary:
				"border-primary-base/40 bg-card text-primary-base-foreground shadow-xs hover:border-primary-base/70 hover:bg-primary-base-soft/30 data-[state=checked]:border-primary-base data-[state=checked]:bg-primary-base data-[state=checked]:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25),0_1px_2px_color-mix(in_oklch,var(--color-primary-base,#7c3aed)_25%,transparent)] data-[state=indeterminate]:border-primary-base data-[state=indeterminate]:bg-primary-base data-[state=indeterminate]:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25),0_1px_2px_color-mix(in_oklch,var(--color-primary-base,#7c3aed)_25%,transparent)] dark:border-primary-base/50 dark:bg-card/40 dark:hover:border-primary-base/80 dark:data-[state=checked]:border-primary-base dark:data-[state=checked]:bg-primary-base dark:data-[state=indeterminate]:border-primary-base dark:data-[state=indeterminate]:bg-primary-base",
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
});

export interface CheckboxProps
	extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>,
		VariantProps<typeof checkboxVariants> {}

/** 保留 Radix Checkbox 的 WAI-ARIA 语义，支持 checked、unchecked 和 indeterminate。 */
function Checkbox({ className, variant = "default", size = "default", ...props }: CheckboxProps) {
	return (
		<CheckboxPrimitive.Root
			data-slot="checkbox"
			data-variant={variant}
			data-size={size}
			className={checkboxVariants({ variant, size, className })}
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
