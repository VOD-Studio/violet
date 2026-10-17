import { tv, type VariantProps } from "tailwind-variants/lite";

/** 返回视觉控件外壳的 BEM 类名；外观由 input.css 定义。 */
export const inputVariants = tv({
	base: "v-input-control",
	variants: {
		variant: {
			outline: "v-input-control--outline",
			soft: "v-input-control--soft",
			ghost: "v-input-control--ghost",
			underline: "v-input-control--underline",
		},
		controlSize: {
			sm: "v-input-control--sm",
			md: "v-input-control--md",
			lg: "v-input-control--lg",
		},
	},
	defaultVariants: {
		variant: "outline",
		controlSize: "md",
	},
});

/** Input 视觉变体与尺寸，不改变 HTML size 的字符宽度语义。 */
export type InputVariantProps = VariantProps<typeof inputVariants>;
