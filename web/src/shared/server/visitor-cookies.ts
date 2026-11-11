import { CSRF_COOKIE } from "@shared/api/csrf";
import { APPEARANCE_COOKIE_NAME } from "@shared/lib/appearance-cookie";
import {
	DECORATION_COOKIE_NAME,
	DECORATION_LAYERS_COOKIE_NAME,
} from "@shared/lib/decoration-preference";
import { THEME_COOKIE_NAME } from "@shared/lib/theme-preference";

/** 决定 SSR 首帧的访客偏好；`theme` 是外观 cookie 的旧名，迁移前仍参与解析。 */
const RENDER_COOKIES = new Set([
	APPEARANCE_COOKIE_NAME,
	"theme",
	THEME_COOKIE_NAME,
	DECORATION_COOKIE_NAME,
	DECORATION_LAYERS_COOKIE_NAME,
]);

/** 游客也会带、SSR 不读取的令牌：CSRF 与站点印象设备令牌。 */
const ANONYMOUS_COOKIES = new Set([CSRF_COOKIE, "violet_impression"]);

/**
 * 匿名访客的渲染变体。
 *
 * 会话 cookie 的名字由后端部署配置决定，这里不靠名字认会话：
 * 只要出现名单外的 cookie 就按「可能已登录」处理。
 *
 * @param cookieHeader - 入口请求的 Cookie 头
 * @returns 请求只带访客偏好与匿名令牌时，返回决定 SSR 输出的偏好指纹（没有偏好时为空串）；否则为 null
 */
export function anonymousRenderVariant(cookieHeader: string): string | null {
	const preferences: string[] = [];
	for (const part of cookieHeader.split(";")) {
		const pair = part.trim();
		if (!pair) continue;
		const separator = pair.indexOf("=");
		const name = separator < 0 ? pair : pair.slice(0, separator);
		if (RENDER_COOKIES.has(name)) preferences.push(pair);
		else if (!ANONYMOUS_COOKIES.has(name)) return null;
	}
	// 浏览器发送 cookie 的顺序取决于写入先后，同一组偏好应得到同一个指纹
	return preferences.sort().join("; ");
}
