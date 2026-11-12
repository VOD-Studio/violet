import type { ComponentProps, ReactNode } from "react";
import { type BadgeVariantProps, badgeVariants } from "./styles";

/** 状态文字本身就是信息；圆点或图标只是装饰，对读屏隐藏。 */
export interface BadgeProps extends ComponentProps<"span">, BadgeVariantProps {
	/** 取代圆点（如定时用的时钟）。 */
	icon?: ReactNode;
}

/**
 * 表示一条记录当前状态的药丸徽章；颜色只表示状态，不做装饰。
 */
export function Badge({ tone = "neutral", icon, className, children, ...props }: BadgeProps) {
	return (
		<span data-slot="badge" {...props} className={badgeVariants({ tone, className })}>
			<span className={icon != null ? "v-badge__icon" : "v-badge__dot"} aria-hidden="true">
				{icon}
			</span>
			{children}
		</span>
	);
}
