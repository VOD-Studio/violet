import { useSettings } from "@features/settings/api/queries";

/**
 * 根据站点公开配置与客户端环境变量，判断第三方 OAuth（Google / GitHub）登录按钮的可见性。
 *
 * @remarks
 * 站点开关关闭或未配置 Client ID 时对应按钮隐藏；配置加载完成前默认显示以避免布局闪烁。
 *
 * @returns 包含 `showGoogle`、`showGithub` 与 `showOAuth` 布尔状态的对象
 *
 * @example
 * ```tsx
 * const { showGoogle, showGithub, showOAuth } = useOAuthVisibility();
 * if (!showOAuth) return null;
 * ```
 */
export function useOAuthVisibility() {
	const { data: settings } = useSettings();

	const googleConfigured = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;
	const githubConfigured = !!import.meta.env.VITE_GITHUB_CLIENT_ID;

	const googleEnabled = settings?.google_login_enabled ?? true;
	const githubEnabled = settings?.github_login_enabled ?? true;

	const showGoogle = googleConfigured && googleEnabled;
	const showGithub = githubConfigured && githubEnabled;
	const showOAuth = showGoogle || showGithub;

	return { showGoogle, showGithub, showOAuth };
}
