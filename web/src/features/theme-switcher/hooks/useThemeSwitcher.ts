import { CUSTOM_THEME_STYLE_ID, generateCustomThemeCss } from "@shared/lib/theme-css";
import {
	persistThemePreference,
	renderedTheme,
	resolvePresetTheme,
	type ThemePreference,
} from "@shared/lib/theme-preference";
import { animateAppearanceRipple } from "@shared/ui/appearance-transition";
import { useRouteContext, useRouter } from "@tanstack/react-router";
import type { NormalizedTheme } from "@violetjs/theme";
import { useCallback } from "react";

/** 扩散动画的像素原点；缺省为视口中心。 */
export interface ThemeSwitchOrigin {
	px: number;
	py: number;
}

/** 以元素中心为扩散原点，用于从被选中的选项开始扩散。 */
export function originOf(element: Element): ThemeSwitchOrigin {
	const rect = element.getBoundingClientRect();
	return { px: rect.left + rect.width / 2, py: rect.top + rect.height / 2 };
}

const sameTheme = (a: NormalizedTheme | null, b: NormalizedTheme | null) =>
	JSON.stringify(a) === JSON.stringify(b);

/**
 * 读取并切换主题偏好。
 *
 * 切换时先同步改写 `<html data-theme>`（自定义主题先写入样式），渲染结果变化则复用外观切换的圆形扩散；
 * cookie 写入且 DOM 更新后再刷新路由上下文，依赖主题的组件随之更新。
 */
export function useThemeSwitcher() {
	const router = useRouter();
	const { theme } = useRouteContext({ from: "__root__" });
	const current = renderedTheme(theme);

	const commit = useCallback(
		async (
			next: { preference: ThemePreference; custom: NormalizedTheme | null },
			origin?: ThemeSwitchOrigin,
		) => {
			const preset = resolvePresetTheme(next.preference, new Date());
			const target = renderedTheme({ ...next, preset });
			const root = document.documentElement;
			const apply = () => {
				if (next.custom) {
					const style = document.getElementById(CUSTOM_THEME_STYLE_ID);
					if (style) style.textContent = generateCustomThemeCss(next.custom);
				}
				root.dataset.theme = target;
				root.dataset.season = preset;
			};
			let updated: Promise<unknown> = Promise.resolve();
			if (target === current && target !== "custom") {
				apply();
			} else {
				const transition = animateAppearanceRipple(
					origin ?? { px: window.innerWidth / 2, py: window.innerHeight / 2 },
					apply,
					root.classList.contains("dark") ? "dark" : "light",
				);
				// 路由上下文从 DOM 读取预设，须等 View Transition 执行完 DOM 更新
				if (transition) updated = transition.updateCallbackDone.catch(() => undefined);
			}
			await Promise.all([persistThemePreference(next.preference, next.custom), updated]);
			await router.invalidate();
		},
		[router, current],
	);

	/** 选择跟随季节或某一季；同时清除自定义主题。 */
	const switchTheme = useCallback(
		(preference: ThemePreference, origin?: ThemeSwitchOrigin) => {
			if (preference === theme.preference && !theme.custom) return Promise.resolve();
			return commit({ preference, custom: null }, origin);
		},
		[commit, theme.preference, theme.custom],
	);

	/** 应用自定义主题；原来的预设偏好保留，自定义主题失效时回落到它。 */
	const applyCustomTheme = useCallback(
		(next: NormalizedTheme, origin?: ThemeSwitchOrigin) => {
			if (sameTheme(theme.custom, next)) return Promise.resolve();
			return commit({ preference: theme.preference, custom: next }, origin);
		},
		[commit, theme.preference, theme.custom],
	);

	return {
		preference: theme.preference,
		preset: theme.preset,
		custom: theme.custom,
		switchTheme,
		applyCustomTheme,
	};
}
