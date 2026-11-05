import { tv, type VariantProps } from "tailwind-variants/lite";

/**
 * 返回 Tag 与 TagToggle 的公开 BEM 类名；外观由 badge.css 定义。
 */
export const tagVariants = tv({
	base: "v-tag",
	variants: {
		size: {
			xs: "v-tag--xs",
			sm: "v-tag--sm",
			md: "",
			lg: "v-tag--lg",
		},
		tone: {
			neutral: "",
			accent: "v-tag--accent",
		},
		toggle: {
			true: "v-tag--toggle",
			false: "",
		},
	},
	defaultVariants: {
		size: "md",
		tone: "neutral",
		toggle: false,
	},
});

/** Tag 视觉变体的推导类型，不含 TagToggle 内部的 toggle 开关。 */
export type TagVariantProps = Omit<VariantProps<typeof tagVariants>, "toggle">;

/**
 * 返回状态徽章 Badge 的公开 BEM 类名；外观由 badge.css 定义。
 */
export const badgeVariants = tv({
	base: "v-badge",
	variants: {
		tone: {
			neutral: "",
			ok: "v-badge--ok",
			accent: "v-badge--accent",
			warning: "v-badge--warning",
			off: "v-badge--off",
			danger: "v-badge--danger",
		},
	},
	defaultVariants: {
		tone: "neutral",
	},
});

/** Badge 色调的推导类型。 */
export type BadgeVariantProps = VariantProps<typeof badgeVariants>;

/**
 * 返回 Count 的公开 BEM 类名；外观由 badge.css 定义。
 */
export const countVariants = tv({
	base: "v-count",
	variants: {
		variant: {
			capsule: "",
			inline: "v-count--inline",
		},
	},
	defaultVariants: {
		variant: "capsule",
	},
});

/** Count 形态的推导类型。 */
export type CountVariantProps = VariantProps<typeof countVariants>;
