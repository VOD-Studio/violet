import type { SessionClaims } from "@entities/user/model/types";
import { createServerFn } from "@tanstack/react-start";
import { getServerHttpClient } from "./auth";
import { getForwardedCookie } from "./cookies";
import { anonymousRenderVariant } from "./visitor-cookies";

/**
 * getAuthSession - SSR 鉴权探活（server function）
 *
 * 包成 createServerFn 是为了满足 TanStack Start 的 import-protection 约束：
 * __root 的 beforeLoad 在 SSR 与客户端 SPA 导航时都会执行，
 * 而 getServerHttpClient → getRequestHeader 是 server-only（依赖请求 AsyncLocalStorage）。
 *
 * createServerFn 在两端编译为不同实现：
 * - SSR：在当前请求进程内直接执行（可读 cookie）
 * - 客户端：编译成 RPC，回调服务器执行（cookie 由服务端读取）
 *
 * 已知只带访客偏好或匿名令牌时直接返回 null；其余请求转发 cookie
 * 到后端 GET /auth/session。无效会话和网络故障也返回 null，不让 SSR 整页失败。
 *
 * @returns 当前会话 claims，未登录或出错时返回 null
 */
export const getAuthSession = createServerFn({ method: "GET" }).handler(
	async (): Promise<SessionClaims | null> => {
		// 只带访客偏好与匿名令牌的请求不可能有会话，不必为它问后端
		if (anonymousRenderVariant(getForwardedCookie()) !== null) return null;
		try {
			const client = getServerHttpClient();
			const res = await client.get<{ data: SessionClaims }>("/auth/session");
			return res.data.data;
		} catch {
			return null;
		}
	},
);
