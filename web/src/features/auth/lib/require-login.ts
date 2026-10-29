import type { UserDTO } from "@entities/user/model/types";
import { isSessionActive } from "@shared/api/session";
import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { authKeys } from "../api/keys";

interface RequireLoginArgs {
	context: { queryClient: QueryClient; auth: { isAuthenticated: boolean } };
	location: { href: string };
}

/**
 * 路由 beforeLoad 登录守卫：未登录时跳转登录页，并携带当前地址作为回跳目标。
 *
 * 会话标记与 me 缓存任一存在即放行，避免客户端导航时 SSR 鉴权快照滞后造成误跳。
 */
export function requireLogin({ context, location }: RequireLoginArgs): void {
	const me = context.queryClient.getQueryData<UserDTO | null>(authKeys.me());
	if (!context.auth.isAuthenticated && !isSessionActive() && !me) {
		throw redirect({
			to: "/login",
			search: { redirect: location.href },
			replace: true,
		});
	}
}
