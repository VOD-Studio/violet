import { tv, type VariantProps } from "tailwind-variants/lite";

/** 数值输入的布局类；外壳变体与尺寸沿用 inputVariants。 */
export const numberInputVariants = tv({
	base: "v-number-input",
	variants: {
		controls: {
			sides: "v-number-input--sides",
			stacked: "v-number-input--stacked",
			none: "v-number-input--none",
		},
	},
	defaultVariants: { controls: "sides" },
});

/** 步进按钮的布局，不改变键盘步进能力。 */
export type NumberInputVariantProps = VariantProps<typeof numberInputVariants>;
