import { useCallback } from "react";
import { useTheme } from "next-themes";

/** 过渡原点（百分比，0..100） */
export interface TransitionOrigin {
	x: number;
	y: number;
}

export interface ViewportSize {
	w: number;
	h: number;
}

/**
 * resolveTransitionOrigin - 把点击事件换算为百分比坐标
 *
 * 导出为纯函数便于单测：无 DOM 副作用，只算数学。
 */
export function resolveTransitionOrigin(
	ev: MouseEvent | { clientX?: number; clientY?: number },
	vp: ViewportSize,
): TransitionOrigin {
	const x = ev.clientX ?? vp.w / 2;
	const y = ev.clientY ?? vp.h / 2;
	return {
		x: vp.w > 0 ? Math.max(0, Math.min(100, (x / vp.w) * 100)) : 50,
		y: vp.h > 0 ? Math.max(0, Math.min(100, (y / vp.h) * 100)) : 50,
	};
}

/**
 * useThemeTransition - 包裹 next-themes.setTheme，叠加 clip-path 圆形扩散
 *
 * 返回 toggle(event?)：在点击点展开新主题。
 * 不改 next-themes 的 class 注入与 cookie 行为（保留架构）。
 */
export function useThemeTransition() {
	const { theme, setTheme } = useTheme();

	const toggle = useCallback(
		(ev?: { clientX?: number; clientY?: number }) => {
			const vp: ViewportSize = {
				w: typeof window !== "undefined" ? window.innerWidth : 0,
				h: typeof window !== "undefined" ? window.innerHeight : 0,
			};
			const { x, y } = resolveTransitionOrigin(ev ?? {}, vp);

			// 在 <html> 上写原点 + 临时挂遮罩层（由 ThemeOverlay 组件渲染）
			const root = document.documentElement;
			root.style.setProperty("--theme-x", `${x}%`);
			root.style.setProperty("--theme-y", `${y}%`);
			root.dataset.themeTransitioning = "1";

			// next-themes 切换 class（cookie 持久化由 next-themes 负责）
			setTheme(theme === "dark" ? "light" : "dark");

			// 400ms 后清理（与 styles.css 中 transition 时长一致）
			window.setTimeout(() => {
				delete root.dataset.themeTransitioning;
			}, 400);
		},
		[theme, setTheme],
	);

	return { toggle, theme };
}
