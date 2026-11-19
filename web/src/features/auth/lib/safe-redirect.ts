/**
 * 校验登录回跳目标，仅放行站内绝对路径。
 *
 * 通过 URL 解析确认来源，避免浏览器移除控制字符或归一反斜杠后变成站外地址。
 */
export function safeRedirectTarget(raw: string | undefined): string {
	if (!raw?.startsWith("/")) {
		return "/";
	}
	const origin = "https://violet.invalid";
	try {
		const target = new URL(raw, origin);
		if (target.origin === origin && !target.pathname.startsWith("//")) {
			return target.pathname + target.search + target.hash;
		}
	} catch {
		return "/";
	}
	return "/";
}
