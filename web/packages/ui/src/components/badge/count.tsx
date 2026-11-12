import { cn } from "cn";
import type { ComponentProps, ReactNode } from "react";
import { type CountVariantProps, countVariants } from "./styles";

/** 胶囊计数是装饰：数量必须写进宿主的可访问名称（如「消息，3 条未读」）。 */
export interface CountProps extends Omit<ComponentProps<"span">, "children">, CountVariantProps {
	value: number;
	/** 超过该值显示 `${max}+`。 */
	max?: number;
}

/**
 * 数量徽章：capsule 是压在宿主角上的墨色胶囊，对读屏隐藏；inline 是跟在文字后的小号数字，属于正文。
 *
 * @remarks capsule 配合 {@link BadgeAnchor} 定位。
 */
export function Count({ value, max = 99, variant = "capsule", className, ...props }: CountProps) {
	// NaN 与负数一并按 0 处理
	const count = value > 0 ? value : 0;
	if (count === 0) return null;
	return (
		<span
			data-slot="count"
			{...props}
			className={countVariants({ variant, className })}
			aria-hidden={variant === "capsule" ? true : props["aria-hidden"]}
		>
			{count > max ? `${max}+` : count}
		</span>
	);
}

/** 只提示「有新的」的 8px 危险色圆点，对读屏隐藏；含义写进宿主名称（如「头像，有新动态」）。 */
export function Dot({ className, ...props }: Omit<ComponentProps<"span">, "children">) {
	return (
		<span data-slot="dot" {...props} className={cn("v-dot", className)} aria-hidden="true" />
	);
}

/** corner 在右上角外挂 Count 胶囊，edge 让 Dot 贴住右上边缘。 */
export type BadgePlacement = "corner" | "edge";

/** 原生 span 属性落在外层包装上；children 原样渲染，焦点与点击仍属于宿主。 */
export interface BadgeAnchorProps extends ComponentProps<"span"> {
	/** 通常是 {@link Count} 或 {@link Dot}；省略时不渲染装饰层。 */
	badge?: ReactNode;
	placement?: BadgePlacement;
	children: ReactNode;
}

/** 把角标钉在宿主角上；装饰层不拦截指针、对读屏隐藏。 */
export function BadgeAnchor({
	badge,
	placement = "corner",
	children,
	className,
	...props
}: BadgeAnchorProps) {
	return (
		<span data-slot="badge-anchor" {...props} className={cn("v-badge-anchor", className)}>
			{children}
			{badge != null && typeof badge !== "boolean" && (
				<span
					className="v-badge-anchor__badge"
					data-placement={placement}
					aria-hidden="true"
				>
					{badge}
				</span>
			)}
		</span>
	);
}
