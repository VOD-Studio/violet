import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

/**
 * ThemeOverlay - 主题切换时的 clip-path 圆形扩散遮罩
 *
 * 监听 <html data-theme-transitioning>：当 useThemeTransition 触发时，
 * 一层覆盖整个视口的「新主题背景色」从点击点圆形展开（400ms），
 * 展开完成后 next-themes 已切完 class，遮罩淡出。
 *
 * 严格遵守 spec：拒绝全屏闪烁，用 clip-path 扩散。
 */
const ThemeOverlay = () => {
	const { theme } = useTheme();
	const [active, setActive] = useState(false);

	useEffect(() => {
		const root = document.documentElement;
		const obs = new MutationObserver(() => {
			if (root.dataset.themeTransitioning === "1") setActive(true);
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

	// 遮罩色 = 即将切换到的目标主题的 background
	// 当前 theme 由 next-themes 给出；toggle 触发后 theme 会变，
	// 这里用「当前 theme 的反色」作为遮罩目标色，确保视觉连续。
	const targetIsDark = theme !== "dark";

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
