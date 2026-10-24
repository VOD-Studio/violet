import {
	persistThemePreference,
	resolvePresetTheme,
	type ThemePreference,
} from "@shared/lib/theme-preference";
import { animateAppearanceRipple } from "@shared/ui/appearance-transition";
import { useRouteContext, useRouter } from "@tanstack/react-router";
import { useCallback } from "react";

/** 扩散动画的像素原点；缺省为视口中心。 */
export interface ThemeSwitchOrigin {
	px: number;
	py: number;
}

/**
 * 读取并切换主题偏好。
 *
 * 切换时先同步改写 `<html data-theme>`，预设变化则复用外观切换的圆形扩散；
 * cookie 写入且 DOM 更新后再刷新路由上下文，依赖主题的组件随之更新。
 */
export function useThemeSwitcher() {
	const router = useRouter();
	const { theme } = useRouteContext({ from: "__root__" });

	const switchTheme = useCallback(
		async (preference: ThemePreference, origin?: ThemeSwitchOrigin) => {
			if (preference === theme.preference) return;
			const preset = resolvePresetTheme(preference, new Date());
			const root = document.documentElement;
			const apply = () => {
				root.dataset.theme = preset;
			};
			let updated: Promise<unknown> = Promise.resolve();
			if (preset === theme.preset) {
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
			await Promise.all([persistThemePreference(preference), updated]);
			await router.invalidate();
		},
		[router, theme.preference, theme.preset],
	);

	return { preference: theme.preference, preset: theme.preset, switchTheme };
}
