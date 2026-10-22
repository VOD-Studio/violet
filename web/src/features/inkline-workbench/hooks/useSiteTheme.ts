import { subscribeThemeRerender } from "@shared/lib/theme-rerender";
import { useEffect, useState } from "react";
import type { DemoTheme } from "../lib/theme-palette";

/**
 * 站点当前明暗主题；随主题切换更新，示例借此换色。
 *
 * @remarks 订阅主题重渲染表而不是监听 html 的 class：切换动画结束后才换色，与图块一致。
 */
export function useSiteTheme(): DemoTheme {
	const [theme, setTheme] = useState<DemoTheme>("light");
	useEffect(() => {
		setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
		return subscribeThemeRerender(setTheme);
	}, []);
	return theme;
}
