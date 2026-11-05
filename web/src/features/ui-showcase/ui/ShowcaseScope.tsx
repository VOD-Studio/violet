import type { Season } from "@shared/lib/theme-preference";
import { cn } from "cn";
import { type ComponentProps, useRef } from "react";
import { useMotionFreeze } from "../hooks/use-motion-freeze";
import styles from "./showcase.module.css";

/** 展品范围的外观：季节或自定义主题、明暗与减弱动态。 */
export interface ShowcaseAppearance {
	theme: Season | "custom";
	mode: "light" | "dark";
	reduced: boolean;
}

export interface ShowcaseScopeProps extends ComponentProps<"div"> {
	appearance: ShowcaseAppearance;
}

/**
 * 在子树内重新绑定主题与明暗，不改动站点偏好；不强加背景色，沿用全站纸面底色与罗纹纸。
 */
export function ShowcaseScope({
	appearance,
	className,
	style,
	children,
	...props
}: ShowcaseScopeProps) {
	const ref = useRef<HTMLDivElement>(null);
	useMotionFreeze(ref, appearance.reduced);
	return (
		<div
			{...props}
			ref={ref}
			data-showcase-scope=""
			data-theme={appearance.theme}
			data-motion={appearance.reduced ? "reduce" : undefined}
			className={cn(
				"text-foreground",
				appearance.mode === "dark" && "dark",
				appearance.reduced && styles.reduced,
				className,
			)}
			// 站点为深色时子树要显式回到浅色，light-dark() 才取浅色一侧
			style={{ colorScheme: appearance.mode, ...style }}
		>
			{children}
		</div>
	);
}
