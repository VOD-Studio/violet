import { isSessionActive } from "@shared/api/session";
import { redirect } from "@tanstack/react-router";

/**
 * 图集建/编路由的登录守卫（galleries.new 与 galleries.$id.edit 共用）。
 *
 * 页面刷新后内存态全失，唯一持久的登录信号是 cookie：violet_csrf 非
 * HttpOnly，有它即按已登录放行，真实过期交给 401 拦截器兜底——
 * 与 /profile 的 beforeLoad 同一策略。
 */
export function requireGalleryAuth(location: { href: string }): void {
	const hasAuthCookie = typeof window !== "undefined" && document.cookie.includes("violet_csrf=");
	if (!isSessionActive() && !hasAuthCookie) {
		throw redirect({
			to: "/login",
			search: { redirect: location.href },
			replace: true,
		});
	}
}
