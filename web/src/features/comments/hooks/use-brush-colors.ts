import { useEffect } from "react";
import { applyBrushColors } from "../lib/brush-colors";

/** 季节、明暗与自定义主题变化时，让划线与选区的荧光笔笔触跟着换色。 */
export function useBrushColors(): void {
	useEffect(() => {
		applyBrushColors();
		const observer = new MutationObserver(applyBrushColors);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class", "style", "data-season", "data-theme"],
		});
		const scheme = window.matchMedia?.("(prefers-color-scheme: dark)");
		scheme?.addEventListener("change", applyBrushColors);
		return () => {
			observer.disconnect();
			scheme?.removeEventListener("change", applyBrushColors);
		};
	}, []);
}
