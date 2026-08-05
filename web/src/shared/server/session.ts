import type { SessionClaims } from "@entities/user/model/types";
import { createServerFn } from "@tanstack/react-start";
import { getServerHttpClient } from "./auth";

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
 * 业务逻辑：转发浏览器 cookie 到后端 GET /auth/session：
 * - cookie 有效 → 返回 AuthSessionClaims
 * - cookie 无效/缺失 → 返回 null（不抛错，让页面正常渲染游客视图）
 *
 * 关键：失败时返回 null 而非抛错——SSR 不能因鉴权失败导致整页 500。
 *
 * @returns 当前会话 claims，未登录或出错时返回 null
 */
export const getAuthSession = createServerFn({ method: "GET" }).handler(
	async (): Promise<SessionClaims | null> => {
		try {
			const client = getServerHttpClient();
			const res = await client.get<{ data: SessionClaims }>("/auth/session");
			return res.data.data;
		} catch {
			return null;
		}
	},
);
