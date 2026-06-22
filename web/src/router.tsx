import type { QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";

import type { UserDTO } from "./entities/user/model/types";
import { routeTree } from "./routeTree.gen";
import { createQueryClient } from "./shared/api/query-client";

/**
 * RouterContext - 全路由共享的上下文
 *
 * 在 __root 的 beforeLoad 中填充：
 * - queryClient：SSR 每请求独立实例（避免跨请求缓存串扰），客户端复用单例
 * - auth：SSR 期间确定的鉴权快照，client hydrate 时复用（避免二次请求）
 */
export interface RouterContext {
	/** TanStack Query 实例 */
	queryClient: QueryClient;
	/** 鉴权状态 */
	auth: {
		/** 是否已登录 */
		isAuthenticated: boolean;
		/** 当前用户（未登录为 null） */
		user: UserDTO | null;
	};
}

/**
 * getRouter - 创建 TanStack Router 实例
 *
 * queryClient 在 router 实例化时注入单例（客户端复用，SSR 由 router 重建），
 * auth 初始为未登录态，由 __root 的 beforeLoad 在请求开始时覆盖为真实值。
 */
export const getRouter = () => {
	const queryClient = createQueryClient();
	const router = createTanStackRouter({
		routeTree,
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		context: {
			queryClient,
			auth: { isAuthenticated: false, user: null },
		},
	});

	return router;
};

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
