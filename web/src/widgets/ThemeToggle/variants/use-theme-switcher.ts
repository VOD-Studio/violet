import { animateThemeRipple, applyThemeClass } from "@shared/ui/theme-transition";
import { useTheme } from "next-themes";
import { useCallback } from "react";
import type { TargetTheme } from "@/shared/lib/theme-rerender";
import type { ThemeOption } from "./types";

/**
 * ThemePointer - 触发切换时的指针坐标
 */
interface ThemePointer {
	clientX?: number;
	clientY?: number;
}

/**
 * useThemeSwitcher - 支持 light / dark / system 三态的圆形扩散切换
 *
 * 封装 next-themes.setTheme，并在支持的浏览器里用 View Transitions
 * 从点击位置圆形揭开新主题。仅在目标与当前显式设置不同时才执行动画。
 * 扩散动画编排统一复用 animateThemeRipple。
 */
export function useThemeSwitcher() {
	const { theme, setTheme } = useTheme();

	const switchTheme = useCallback(
		(target: ThemeOption, pointer?: ThemePointer) => {
			if (theme === target) {
				return;
			}
			const px = pointer?.clientX ?? window.innerWidth / 2;
			const py = pointer?.clientY ?? window.innerHeight / 2;
			// target 为 system 时解析出实际主题：图块重渲与 class 切换只要 dark/light 二态
			const resolvedTarget: TargetTheme =
				target === "system"
					? window.matchMedia("(prefers-color-scheme: dark)").matches
						? "dark"
						: "light"
					: target;
			// next-themes setTheme 放 VT update 里会卡死（见 theme-transition 注释）：
			// update 里手动切 class，finished 后再 setTheme 同步状态与存储
			const tr = animateThemeRipple(
				{ px, py },
				() => applyThemeClass(resolvedTarget),
				resolvedTarget,
			);
			if (tr) {
				tr.finished.finally(() => setTheme(target));
			} else {
				setTheme(target);
			}
		},
		[theme, setTheme],
	);

	// 用判空收窄替代 as 断言：next-themes 的 theme 是 string | undefined，
	// 收窄到三态之一或 undefined。显式注解避免 TS 把字面量联合拓宽成 string。
	const resolved: ThemeOption | undefined =
		theme === "light" || theme === "dark" || theme === "system" ? theme : undefined;

	return { theme: resolved, switchTheme };
}
