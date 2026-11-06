import { tv, type VariantProps } from "tailwind-variants/lite";

/** 返回输入框外壳的 BEM 类名；外观由 input.css 定义。 */
export const inputVariants = tv({
	base: "v-input-control",
	variants: {
		variant: {
			filled: "v-input-control--filled",
			outline: "v-input-control--outline",
			underline: "v-input-control--underline",
			plain: "v-input-control--plain",
		},
		controlSize: {
			sm: "v-input-control--sm",
			md: "v-input-control--md",
			lg: "v-input-control--lg",
		},
	},
	defaultVariants: {
		variant: "filled",
		controlSize: "md",
	},
});

/**
 * Input 视觉变体与尺寸，不改变 HTML size 的字符宽度语义。
 *
 * `variant`：`filled` 凹陷底（默认）、`outline` 描边、`underline` 下划线、`plain` 无框。
 */
export type InputVariantProps = VariantProps<typeof inputVariants>;
