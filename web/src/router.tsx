import type { SessionClaims } from "@entities/user/model/types";
import type { QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { clientQueryClient } from "./shared/api/query-client";
import { getNavDirection, isAdminRoute } from "./shared/lib/nav-direction";
import { useViewTransitionStore } from "./shared/lib/view-transition-store";

/**
 * RouterContext - 全路由共享的上下文
 *
 * 在 __root 的 beforeLoad 中填充：
 * - queryClient：SSR 每请求独立实例（避免跨请求缓存串扰），客户端复用单例
 * - auth：SSR 期间通过 /auth/session 确定的鉴权快照，client hydrate 时复用
 */
export interface RouterContext {
	/** TanStack Query 实例 */
	queryClient: QueryClient;
	/** 鉴权状态 */
	auth: {
		/** 是否已登录 */
		isAuthenticated: boolean;
		/** /auth/session 返回的 claims（未登录为 null） */
		claims: SessionClaims | null;
	};
	/** SSR 已 resolve 的主题（"light"/"dark"），用于 <html> class 防 FOUC */
	theme: "light" | "dark";
}

/**
 * getRouter - 创建 TanStack Router 实例
 *
 * queryClient 在 router 实例化时注入单例（客户端复用，SSR 由 router 重建），
 * auth 初始为未登录态，由 __root 的 beforeLoad 在请求开始时覆盖为真实值。
 */
export const getRouter = () => {
	const router = createTanStackRouter({
		routeTree,
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 30_000,
		defaultViewTransition: {
			types: ({ fromLocation, toLocation, pathChanged }) => {
				if (!pathChanged) return false;
				const to = toLocation.pathname;
				const from = fromLocation?.pathname;

				// 离开博客段时清零共享封面状态
				const isBlog = (p?: string) => p === "/blog" || p?.startsWith("/blog/");
				if (!isBlog(to) || !isBlog(from)) {
					useViewTransitionStore.getState().setSharedCoverSlug(null);
				}

				// 后台段不做 View Transition：侧边栏/顶栏等静态区域会随整页
				// root 快照一起淡入淡出，表现为布局闪烁；后台导航无需转场。
				if (isAdminRoute(to) || (from && isAdminRoute(from))) {
					return false;
				}
				const dir = getNavDirection(from, to);
				return dir ? [dir] : ["fade"];
			},
		},
		context: {
			queryClient: clientQueryClient,
			auth: { isAuthenticated: false, claims: null },
			theme: "light",
		},
	});

	return router;
};

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
