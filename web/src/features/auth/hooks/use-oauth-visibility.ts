import { useSettings } from "@features/settings/api/queries";

/**
 * 根据站点公开配置与客户端环境变量，判断第三方 OAuth（Google / GitHub）登录按钮的可见性。
 *
 * @remarks
 * 站点开关关闭或未配置 Client ID 时对应按钮隐藏；配置加载完成前默认显示以避免布局闪烁。
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

	// client_id 以后台实时下发为准（env 构建值仅作 settings 未加载时的兜底）：
	// 后台改凭据后无需重新构建前端
	const googleConfigured =
		!!settings?.google_client_id || !!import.meta.env.VITE_GOOGLE_CLIENT_ID;
	const githubConfigured =
		!!settings?.github_client_id || !!import.meta.env.VITE_GITHUB_CLIENT_ID;

	const googleEnabled = settings?.google_login_enabled ?? true;
	const githubEnabled = settings?.github_login_enabled ?? true;

	const showGoogle = googleConfigured && googleEnabled;
	const showGithub = githubConfigured && githubEnabled;
	const showOAuth = showGoogle || showGithub;

	// 实时 client_id（后台写入即变，空串=未配置，调用方需 fallback 构建期 env）
	const googleClientId = settings?.google_client_id ?? "";
	const githubClientId = settings?.github_client_id ?? "";

	return { showGoogle, showGithub, showOAuth, googleClientId, githubClientId };
}
