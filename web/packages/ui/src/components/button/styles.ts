import { tv, type VariantProps } from "tailwind-variants/lite";

/**
 * 返回 Button 的公开 BEM 类名；外观由 button.css 定义。
 *
 * 六种变体从强到弱；三档尺寸与输入框同高（32 / 36 / 40，触屏各加 4）。
 */
export const buttonVariants = tv({
	base: "v-button",
	variants: {
		variant: {
			primary: "v-button--primary",
			secondary: "v-button--secondary",
			outline: "v-button--outline",
			ghost: "v-button--ghost",
			destructive: "v-button--destructive",
			link: "v-button--link",
		},
		size: {
			sm: "v-button--sm",
			md: "",
			lg: "v-button--lg",
		},
	},
	defaultVariants: {
		variant: "secondary",
		size: "md",
	},
});

/** Button 视觉变体与尺寸的推导类型。 */
export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
