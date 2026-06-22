import { TanStackDevtools } from "@tanstack/react-devtools";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
	ScrollRestoration,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import type { RouterContext } from "../router";
import AppProvider from "../shared/api/provider";
import { getCurrentUser } from "../shared/server/session";

import appCss from "../styles.css?url";

/**
 * __root - 根路由，所有路由共享
 *
 * queryClient 从 router context 复用（router.tsx 注入单例），
 * beforeLoad 仅返回 auth（serializable，可通过 dehydrate 传给客户端）。。
 */
export const Route = createRootRouteWithContext<RouterContext>()({
	beforeLoad: async () => {
		const user = await getCurrentUser();
		return {
			auth: {
				isAuthenticated: user !== null,
				user,
			},
		};
	},
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Blog" },
		],
		links: [{ rel: "stylesheet", href: appCss }],
	}),
	component: RootComponent,
	shellComponent: RootDocument,
});

/**
 * RootComponent - 根组件
 *
 * 装配 AppProvider（QueryClient + Theme + Toaster）+ 子路由出口 + devtools。
 */
function RootComponent() {
	return (
		<AppProvider>
			<Outlet />
			<TanStackDevtools
				config={{ position: "bottom-right" }}
				plugins={[
					{
						name: "Tanstack Router",
						render: <TanStackRouterDevtoolsPanel />,
					},
				]}
			/>
		</AppProvider>
	);
}

/**
 * RootDocument - HTML 外壳（TanStack Start shellComponent 约定）
 *
 * 必须渲染 HeadContent 与 Scripts，否则 SSR 不工作。
 */
function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="zh-CN" suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}
