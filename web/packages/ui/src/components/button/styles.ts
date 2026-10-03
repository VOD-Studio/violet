import { tv, type VariantProps } from "tailwind-variants/lite";

/**
 * 返回 Button 的公开 BEM 类名；外观由 button.css 定义。
 */
export const buttonVariants = tv({
	base: "v-button",
	variants: {
		variant: {
			default: "v-button--default",
			primary: "v-button--primary",
			secondary: "v-button--secondary",
			soft: "v-button--soft",
			outline: "v-button--outline",
			ghost: "v-button--ghost",
			link: "v-button--link",
			destructive: "v-button--destructive",
		},
		size: {
			default: "",
			xs: "v-button--xs",
			sm: "v-button--sm",
			lg: "v-button--lg",
			xl: "v-button--xl",
			icon: "v-button--icon",
			"icon-xs": "v-button--icon-xs",
			"icon-sm": "v-button--icon-sm",
			"icon-lg": "v-button--icon-lg",
		},
	},
	defaultVariants: {
		variant: "default",
		size: "default",
	},
});

/** Button 视觉变体与尺寸的推导类型。 */
export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
