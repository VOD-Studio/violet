import { tv, type VariantProps } from "tailwind-variants/lite";

/**
 * 返回 Kbd 的公开 BEM 类名；外观由 kbd.css 定义。
 */
export const kbdVariants = tv({
	base: "v-kbd",
	variants: {
		size: {
			sm: "v-kbd--sm",
			md: "",
			lg: "v-kbd--lg",
		},
		variant: {
			default: "",
			light: "v-kbd--light",
			onButton: "v-kbd--on-button",
		},
	},
	defaultVariants: {
		size: "md",
		variant: "default",
	},
});

/** Kbd 尺寸与底色变体的推导类型。 */
export type KbdVariantProps = VariantProps<typeof kbdVariants>;
