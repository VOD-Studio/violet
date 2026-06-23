import { CustomCursor } from "@shared/ui/cursor";
import { TanStackDevtools } from "@tanstack/react-devtools";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
	ScrollRestoration,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import AnnouncementBar from "@widgets/AnnouncementBar";
import CommandPalette from "@widgets/CommandPalette";
import Footer from "@widgets/Footer";
import Header from "@widgets/Header";
import MusicPlayer from "@widgets/MusicPlayer";
import ThemeOverlay from "@widgets/ThemeToggle/ThemeOverlay";
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
	// 兜底：任何 loader 抛错或子树未捕获错误时，渲染在应用外壳内，
	// 避免整页白屏（React 警告「consider setting errorComponent」）。
	errorComponent: ({ error }) => (
		<div className="container mx-auto px-4 py-24 text-center">
			<p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
				System Error
			</p>
			<h1 className="mb-4 font-mono text-3xl font-bold">出错了</h1>
			<p className="mx-auto mb-8 max-w-md text-sm text-muted-foreground">
				{error instanceof Error ? error.message : "未知错误，请稍后重试"}
			</p>
		</div>
	),
});

/**
 * RootComponent - 根组件
 *
 * 装配 AppProvider（QueryClient + Theme + Toaster）+ 子路由出口 + devtools。
 */
function RootComponent() {
	return (
		<AppProvider>
			<AnnouncementBar />
			<Header />
			<main className="min-h-[60vh]">
				<Outlet />
			</main>
			<Footer />
			<MusicPlayer />
			<CommandPalette />
			<ThemeOverlay />
			<CustomCursor />
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
