import { useEffect, useRef } from "react";

/**
 * 全屏工作区跟随软键盘后的可见视口；缩放时保留浏览器原生平移。
 *
 * @returns 容器 ref；宿主使用 --visual-viewport-height 与 --visual-viewport-top 定位。
 */
export function useVisualViewport(enabled: boolean) {
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const element = ref.current;
		const viewport = window.visualViewport;
		if (!enabled || !element || !viewport) return;
		const reset = () => {
			element.style.removeProperty("--visual-viewport-height");
			element.style.removeProperty("--visual-viewport-top");
		};
		const update = () => {
			if (viewport.scale !== 1) {
				reset();
				return;
			}
			element.style.setProperty("--visual-viewport-height", `${viewport.height}px`);
			element.style.setProperty("--visual-viewport-top", `${viewport.offsetTop}px`);
		};
		update();
		viewport.addEventListener("resize", update);
		viewport.addEventListener("scroll", update);
		return () => {
			viewport.removeEventListener("resize", update);
			viewport.removeEventListener("scroll", update);
			reset();
		};
	}, [enabled]);
	return ref;
}
