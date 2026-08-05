import { useSettings } from "@features/settings/api/queries";

/**
 * useOAuthVisibility - 根据站点公开设置和环境变量决定 OAuth 按钮显示状态
 *
 * 站点设置里关闭、或环境变量未配置 Client ID 时，对应按钮隐藏。
 * 设置加载完成前默认视为启用，避免界面空白闪烁。
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
