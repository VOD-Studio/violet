import { tv, type VariantProps } from "tailwind-variants/lite";

/** 返回 Checkbox 的 BEM 类名；外观由 checkbox.css 定义。 */
export const checkboxVariants = tv({
	base: "v-checkbox",
	variants: {
		variant: {
			default: "v-checkbox--default",
			primary: "v-checkbox--primary",
		},
		size: {
			sm: "v-checkbox--sm",
			default: "",
			lg: "v-checkbox--lg",
		},
	},
	defaultVariants: {
		variant: "default",
		size: "default",
	},
});

/** Checkbox 视觉变体与尺寸的推导类型。 */
export type CheckboxVariantProps = VariantProps<typeof checkboxVariants>;
