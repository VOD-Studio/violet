import type { SessionClaims } from "@entities/user/model/types";
// 文章里的 roadmap 卡片：服务端与客户端都要登记，两边渲染才一致
import RouteError from "@shared/ui/route-error";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRouter as createTanStackRouter,
	type RegisteredRouter,
} from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { RuaLoading } from "@widgets/PersonaMotion";
import "./register-article-embeds";
import { routeTree } from "./routeTree.gen";
import { clientQueryClient, createQueryClient } from "./shared/api/query-client";
import { reconcileIntent, resolveViewTransitionTypes } from "./shared/lib/view-transition";

/**
 * 根路由填充鉴权与主题；查询缓存由路由工厂按运行环境创建。
 */
export interface RouterContext {
	/** loader、SSR 渲染与浏览器接管使用同一份路由缓存。 */
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

/** SSR 每请求隔离查询缓存，浏览器复用会话层使用的单例。 */
export const getRouter = () => {
	const queryClient = typeof window === "undefined" ? createQueryClient() : clientQueryClient;
	const router = createTanStackRouter({
		routeTree,
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 30_000,
		defaultPendingComponent: RuaLoading,
		// 路由级错误在出错路由自己的槽位渲染（壳层 Header/Footer 保留），
		// 根级错误才落 __root errorComponent 的整页兜底
		defaultErrorComponent: RouteError,
		defaultPendingMs: 180,
		defaultPendingMinMs: 360,
		// 转场规则见 shared/lib/view-transition：默认淡入淡出，共享元素意图覆盖两端时 morph。
		defaultViewTransition: {
			types: ({ fromLocation, toLocation, pathChanged }) => {
				const from = fromLocation?.pathname;
				const to = toLocation.pathname;
				return resolveViewTransitionTypes({
					from,
					to,
					pathChanged,
					intent: reconcileIntent(from, to),
				});
			},
		},
		context: {
			queryClient,
			auth: { isAuthenticated: false, claims: null },
			theme: "light",
		},
	});
	setupRouterSsrQueryIntegration({ router, queryClient });

	return router;
};

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}

	interface StaticDataRouteOption {
		/** 详情页在 Header 主导航里显示的标题；返回空值则保持常规标签。 */
		navTitle?: (loaderData: never) => string | null | undefined;
	}
}

declare module "@tanstack/react-start" {
	interface Register {
		ssr: true;
		router: RegisteredRouter;
	}
}
