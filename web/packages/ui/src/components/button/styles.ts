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
			/** 旧默认变体，等同于 primary；调用方迁移后删除。 */
			default: "v-button--primary",
			primary: "v-button--primary",
			secondary: "v-button--secondary",
			/** 旧柔和变体，等同于 secondary；调用方迁移后删除。 */
			soft: "v-button--secondary",
			outline: "v-button--outline",
			ghost: "v-button--ghost",
			destructive: "v-button--destructive",
			link: "v-button--link",
		},
		size: {
			sm: "v-button--sm",
			md: "",
			lg: "v-button--lg",
			/** 以下旧尺寸在站点迁移期间保留，迁移完成后删除。 */
			default: "",
			xs: "v-button--sm",
			xl: "v-button--lg",
			icon: "v-button--icon",
			"icon-xs": "v-button--icon-xs",
			"icon-sm": "v-button--icon-sm",
			"icon-lg": "v-button--icon-lg",
		},
	},
	defaultVariants: {
		variant: "secondary",
		size: "md",
	},
});

/** Button 视觉变体与尺寸的推导类型。 */
export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
