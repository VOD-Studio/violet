import { tv, type VariantProps } from "tailwind-variants/lite";

/**
 * 返回多行输入外壳的 BEM 类名；外壳基础类与变体类和 Input 共用，多行差异由 `.v-textarea`
 * 修饰，外观在 input.css 与 textarea.css。
 */
export const textareaVariants = tv({
	base: "v-input-control v-textarea",
	variants: {
		variant: {
			filled: "v-input-control--filled",
			outline: "v-input-control--outline",
			underline: "v-input-control--underline",
			plain: "v-input-control--plain",
		},
	},
	defaultVariants: {
		variant: "filled",
	},
});

/**
 * Textarea 视觉变体，与 Input 同一套画法；不改变原生 `rows` 的行数语义。
 *
 * `variant`：`filled` 凹陷底（默认）、`outline` 描边、`underline` 下划线、`plain` 无框。
 */
export type TextareaVariantProps = VariantProps<typeof textareaVariants>;
