/**
 * 校验登录回跳目标，仅放行站内绝对路径。
 *
 * "//host" 与 "/\\" 开头会被浏览器规范化为协议相对 URL 跳到外部站点，
 * 与绝对 URL 一并拒绝，防登录入口的开放重定向。
 */
export function safeRedirectTarget(raw: string | undefined): string {
	if (raw && /^\/(?!\/)(?!\\)/.test(raw)) return raw;
	return "/";
}
