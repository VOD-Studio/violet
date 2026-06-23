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
 * 是否支持 View Transitions API（运行时探测，SSR 安全）。
 */
function supportsViewTransitions(): boolean {
	return (
		typeof document !== "undefined" &&
		// startViewTransition 在 TS DOM lib 中尚未类型化，用宽松断言探测
		"startViewTransition" in document
	);
}

/**
 * useThemeTransition - 包裹 next-themes.setTheme，叠加 View Transitions 圆形扩散
 *
 * 实现：document.startViewTransition(setTheme)。
 * 浏览器抓取切换前后两帧 DOM 快照（root pseudo），CSS 对
 * ::view-transition-new(root) 做 clip-path circle 从点击点展开。
 * 旧帧全程保持可见 → 无瞬时闪烁；新帧从点击点圆形揭开 → 平滑扩散。
 *
 * 不支持 VT 的浏览器（如 Firefox）降级为瞬时切换（setTheme 直调）。
 * 不改 next-themes 的 class 注入与 cookie 行为（保留架构）。
 */
export function useThemeTransition() {
	const { theme, setTheme } = useTheme();

	const toggle = useCallback(
		(ev?: { clientX?: number; clientY?: number }) => {
			const targetTheme = theme === "dark" ? "light" : "dark";

			// 视口尺寸（SSR 时 window 不存在 → 0，函数内只在 client 调用）
			const vp: ViewportSize =
				typeof window !== "undefined"
					? { w: window.innerWidth, h: window.innerHeight }
					: { w: 0, h: 0 };
			const { x, y } = resolveTransitionOrigin(ev ?? {}, vp);

			// 写原点到 <html> 供 ::view-transition-new(root) 的 CSS 读取
			const root = document.documentElement;
			root.style.setProperty("--theme-x", `${x}%`);
			root.style.setProperty("--theme-y", `${y}%`);

			// 不支持 VT：直接切（瞬时，无动画但不闪烁性 bug）
			if (!supportsViewTransitions()) {
				setTheme(targetTheme);
				return;
			}

			// startViewTransition 的回调里切 class（同步），浏览器抓前后两帧
			const transition = (
				document as Document & {
					startViewTransition?: (cb: () => void) => {
						finished: Promise<void>;
					};
				}
			).startViewTransition!(() => {
				setTheme(targetTheme);
			});

			// 防御：若 VT 异常失败，确保仍切完（finished reject 时手动补切）
			transition?.finished.catch(() => setTheme(targetTheme));
		},
		[theme, setTheme],
	);

	return { toggle, theme };
}
