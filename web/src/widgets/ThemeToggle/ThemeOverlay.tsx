import { useEffect, useState } from "react";

/**
 * ThemeOverlay - 主题切换时的 clip-path 圆形扩散遮罩
 *
 * 监听 <html data-theme-transitioning>：当 useThemeTransition 触发时，
 * 一层覆盖整个视口的「目标主题背景色」从点击点圆形展开（400ms），
 * 展开完成后 next-themes 已切完 class，遮罩淡出。
 *
 * 目标主题从 data-theme-target 读取（在 toggle 时由 useThemeTransition
 * 写入），避免从 next-themes 的 theme 推断产生竞态（setTheme 后 theme
 * 已变，会读到出发色而非到达色）。
 *
 * 严格遵守 spec：拒绝全屏闪烁，用 clip-path 扩散。
 */
const ThemeOverlay = () => {
	const [active, setActive] = useState(false);
	const [targetTheme, setTargetTheme] = useState<string | null>(null);

	useEffect(() => {
		const root = document.documentElement;
		const obs = new MutationObserver(() => {
			if (root.dataset.themeTransitioning === "1") {
				setTargetTheme(root.dataset.themeTarget ?? null);
				setActive(true);
			}
		});
		obs.observe(root, {
			attributes: true,
			attributeFilter: ["data-theme-transitioning"],
		});
		return () => obs.disconnect();
	}, []);

	useEffect(() => {
		if (!active) return;
		const t = window.setTimeout(() => setActive(false), 400);
		return () => window.clearTimeout(t);
	}, [active]);

	if (!active) return null;

	// 遮罩色 = 目标主题的 background（在 toggle 时捕获，无竞态）
	const targetIsDark = targetTheme === "dark";

	return (
		<div
			aria-hidden
			className={active ? "theme-clip is-revealed" : "theme-clip"}
			style={{
				position: "fixed",
				inset: 0,
				zIndex: 9999,
				pointerEvents: "none",
				backgroundColor: targetIsDark ? "hsl(240 10% 4%)" : "hsl(0 0% 98%)",
			}}
		/>
	);
};

export default ThemeOverlay;
