import type { CSSProperties } from "react";
import type { CartoonBubbleVariant, CartoonShadowStyle } from "./types";

interface VariantMeta {
	className: string;
	style: CSSProperties;
}

export const VARIANT_MAP: Record<CartoonBubbleVariant, VariantMeta> = {
	default: {
		className: "bg-card text-foreground border-foreground/80 dark:border-foreground/85",
		style: {
			"--cartoon-bg": "var(--card)",
			"--cartoon-border": "var(--foreground)",
			"--cartoon-shadow": "var(--foreground)",
		} as CSSProperties,
	},
	brand: {
		className:
			"bg-[oklch(0.97_0.02_286)] text-[oklch(0.24_0.06_286)] border-brand dark:bg-[oklch(0.22_0.05_286)] dark:text-[oklch(0.96_0.02_286)] dark:border-brand",
		style: {
			"--cartoon-bg": "oklch(0.97 0.02 286)",
			"--cartoon-border": "var(--color-brand, #7c3aed)",
			"--cartoon-shadow": "var(--color-brand, #7c3aed)",
		} as CSSProperties,
	},
	amber: {
		className:
			"bg-amber-50 text-amber-950 border-amber-500 dark:bg-amber-950/70 dark:text-amber-100 dark:border-amber-400",
		style: {
			"--cartoon-bg": "#fffbeb",
			"--cartoon-border": "#f59e0b",
			"--cartoon-shadow": "#d97706",
		} as CSSProperties,
	},
	mint: {
		className:
			"bg-emerald-50 text-emerald-950 border-emerald-500 dark:bg-emerald-950/70 dark:text-emerald-100 dark:border-emerald-400",
		style: {
			"--cartoon-bg": "#ecfdf5",
			"--cartoon-border": "#10b981",
			"--cartoon-shadow": "#059669",
		} as CSSProperties,
	},
	rose: {
		className:
			"bg-rose-50 text-rose-950 border-rose-400 dark:bg-rose-950/70 dark:text-rose-100 dark:border-rose-400",
		style: {
			"--cartoon-bg": "#fff1f2",
			"--cartoon-border": "#fb7185",
			"--cartoon-shadow": "#f43f5e",
		} as CSSProperties,
	},
	sky: {
		className:
			"bg-sky-50 text-sky-950 border-sky-400 dark:bg-sky-950/70 dark:text-sky-100 dark:border-sky-400",
		style: {
			"--cartoon-bg": "#f0f9ff",
			"--cartoon-border": "#38bdf8",
			"--cartoon-shadow": "#0284c7",
		} as CSSProperties,
	},
	dark: {
		className: "bg-(--cartoon-bg) text-neutral-100",
		style: {
			"--cartoon-bg": "#171723",
			"--cartoon-border": "#74748b",
			"--cartoon-shadow": "#ffffff",
		} as CSSProperties,
	},
};

export function getShadowClass(style: CartoonShadowStyle): string {
	return style === "comic"
		? "shadow-[3px_3px_0_0_var(--cartoon-shadow)]"
		: "shadow-[0_4px_24px_rgba(0,0,0,0.06)]";
}

/** Dark 的文字晚于轮廓显影，关闭时先退字再收笔。 */
export function darkContentOpacity(ink: number): number {
	return Math.max(0, Math.min(1, (ink - 0.25) / 0.75));
}
