import { useSettings } from "@features/settings/api/queries";

/**
 * 根据站点公开配置与客户端环境变量，判断第三方 OAuth（Google / GitHub）登录按钮的可见性。
 *
 * @remarks
 * 等待公开配置后再显示入口；未配置或禁用的服务不会用构建值补成可用。
 *
 * @returns 包含 `showGoogle`、`showGithub`、`showOAuth` 布尔状态与实时
 * `googleClientId`、`githubClientId`（后台写入后即刻更新，空串=未配置）的对象
 *
 * @example
 * ```tsx
 * const { showGoogle, showGithub, showOAuth } = useOAuthVisibility();
 * if (!showOAuth) return null;
 * ```
 */
export function useOAuthVisibility() {
	const { data: settings } = useSettings();

	const googleClientId = settings?.google_client_id ?? "";
	const githubClientId = settings?.github_client_id ?? "";
	const showGoogle = !!googleClientId && settings?.google_login_enabled === true;
	const showGithub = !!githubClientId && settings?.github_login_enabled === true;
	const showOAuth = showGoogle || showGithub;
	return { showGoogle, showGithub, showOAuth, googleClientId, githubClientId };
}
