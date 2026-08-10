import { CustomCursor } from "@shared/ui/cursor";
import NotFound from "@shared/ui/not-found";
import { SystemThemeTransition } from "@shared/ui/theme-transition";
import { TanStackDevtools } from "@tanstack/react-devtools";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
	useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import AnnouncementBar from "@widgets/AnnouncementBar";
import CommandPalette from "@widgets/CommandPalette";
import Footer from "@widgets/Footer";
import Header from "@widgets/Header";
import MusicPlayer from "@widgets/MusicPlayer";
import { LoginDialog } from "@/features/auth/ui/LoginDialog";
import type { RouterContext } from "../router";
import AppProvider from "../shared/api/provider";
import { isSessionActive, markSessionActive } from "../shared/api/session";
import { getAuthSession } from "../shared/server/session";
import { getSSRTheme } from "../shared/server/theme";

import appCss from "../styles.css?url";

/**
 * __root - 根路由，所有路由共享
 *
 * queryClient 从 router context 复用（router.tsx 注入单例），
 * beforeLoad 仅返回 auth（serializable，可通过 dehydrate 传给客户端）。
 */
/** 缓存首次 getAuthSession 结果，客户端 SPA 导航复用避免网络阻塞 */
let cachedClaims: ReturnType<typeof getAuthSession> extends Promise<infer T>
	? T | undefined
	: never;

export const Route = createRootRouteWithContext<RouterContext>()({
	beforeLoad: async () => {
		// SSR 从请求 cookie 读 resolved theme（防 FOUC：<html> 首帧即正确 class）；
		// 客户端从 document.cookie 读（与 SSR 同源，hydration 时 html className 一致）
		const theme: "light" | "dark" =
			typeof window === "undefined"
				? await getSSRTheme()
				: document.cookie.match(/(?:^|; )theme=([^;]*)/)?.[1] === "dark"
					? "dark"
					: "light";
		// SSR 或首次客户端 hydrate：网络获取
		if (typeof window === "undefined" || cachedClaims === undefined) {
			const claims = await getAuthSession();
			cachedClaims = claims ?? null;
			if (claims && typeof window !== "undefined") {
				markSessionActive();
			}
			// 注意：getAuthSession 返回 null 时不清 useMe 缓存也不 clearSessionActive。
			// server function 的 RPC cookie 转发可能不可靠（与浏览器直连的 /auth/me
			// 行为不一致），基于它清缓存会导致误清。session 真过期的清理交给 401 拦截器
			//（走浏览器直连，cookie 正确）：受保护请求收 401 → clearAuthCache +
			// clearSessionActive → 守卫据此踢人。此处仅设 isAuthenticated 供守卫参考。
			return {
				theme,
				auth: {
					isAuthenticated: claims !== null,
					claims,
				},
			};
		}
		// 客户端 SPA 导航：复用缓存，用 sessionActive 检测登出
		if (!isSessionActive()) {
			cachedClaims = null;
			return { theme, auth: { isAuthenticated: false, claims: null } };
		}
		return {
			theme,
			auth: {
				isAuthenticated: cachedClaims !== null,
				claims: cachedClaims,
			},
		};
	},
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Violet" },
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			{ rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
			{ rel: "icon", type: "image/png", sizes: "256x256", href: "/favicon.png" },
			{ rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
			{ rel: "manifest", href: "/manifest.json" },
		],
	}),
	component: RootComponent,
	shellComponent: RootDocument,
	// 兜底：路由未匹配或子树抛出 notFound 错误时渲染统一 404 页面，
	// 避免 TanStack Router 的默认 <p>Not Found</p>。
	notFoundComponent: () => <NotFound className="py-24" />,
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
 * 后台路由（/admin）独立布局，不显示前台 Header/Footer。
 */
function RootComponent() {
	const { auth } = Route.useRouteContext();
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const isAdminRoute = pathname.startsWith("/admin");

	return (
		<AppProvider>
			<SystemThemeTransition />
			{isAdminRoute ? (
				// 后台路由：完全独立的布局，不包含前台 Header/Footer
				<Outlet />
			) : (
				// 前台路由：包含 Header/Footer 的标准布局
				<div className="flex min-h-screen flex-col">
					<AnnouncementBar />
					<Header isAuthenticated={auth.isAuthenticated} />
					<main className="flex-1 flex-col">
						<Outlet />
					</main>
					<Footer />
				</div>
			)}
			<MusicPlayer />
			<CommandPalette />
			<LoginDialog />
			<CustomCursor />
			<TanStackDevtools
				config={{ position: "bottom-left" }}
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
	const { theme } = Route.useRouteContext();
	return (
		<html
			lang="zh-CN"
			className={theme}
			style={{ colorScheme: theme }}
			suppressHydrationWarning
		>
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	);
}
