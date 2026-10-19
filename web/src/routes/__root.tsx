import { CustomCursor } from "@shared/ui/cursor";
import NotFound from "@shared/ui/not-found";
import RouteError from "@shared/ui/route-error";
import { SystemThemeTransition } from "@shared/ui/theme-transition";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
	useRouterState,
} from "@tanstack/react-router";
import { DocumentScrollbar } from "@violet/ui";
import AnnouncementBar from "@widgets/AnnouncementBar";
import CommandPalette from "@widgets/CommandPalette";
import Footer from "@widgets/Footer";
import Header from "@widgets/Header";
import MusicPlayer from "@widgets/MusicPlayer";
import { RuaRouteTransition } from "@widgets/PersonaMotion";
import SiteBackdrop from "@widgets/SiteBackdrop";
import { cn } from "cn";
import { useEffect } from "react";
import { ApiDocsDialog } from "@/features/api-docs";
import { LinkConfirmDialog } from "@/features/auth/ui/LinkConfirmDialog";
import { LoginDialog } from "@/features/auth/ui/LoginDialog";
import { ShareTweetDialog } from "@/features/chat/ui/ShareTweetDialog";
import AppProvider from "../providers";
import type { RouterContext } from "../router";
import { isSessionActive, markSessionActive } from "../shared/api/session";
import { getAuthSession } from "../shared/server/session";
import { getSSRTheme } from "../shared/server/theme";
import appCss from "../styles.css?url";

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
			// CSRF cookie 也会发给游客，只有有效会话 claims 才能建立登录态。
			if (claims && typeof window !== "undefined") {
				markSessionActive();
			}
			return {
				theme,
				auth: {
					isAuthenticated: claims !== null || isSessionActive(),
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
	notFoundComponent: () => <NotFound />,
	// 兜底：任何 loader 抛错或子树未捕获错误时，渲染统一错误页（自带真实页面
	// 几何与公开方言作用域），避免整页白屏（React 警告「consider setting errorComponent」）。
	errorComponent: ({ error }) => <RouteError error={error} />,
});

/**
 * RootComponent - 根组件
 *
 * 装配站点 Provider 与子路由出口；查询缓存 Provider 位于 Router 外层。
 * 后台路由（/admin）独立布局，不显示前台 Header/Footer。
 */
function RootComponent() {
	const { auth } = Route.useRouteContext();
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const isAdminRoute = pathname.startsWith("/admin");
	const isChatRoute = pathname === "/chat" || pathname.startsWith("/chat/");
	const isFullscreenRoute = isChatRoute;
	const isProfileRoute = pathname.startsWith("/profile");
	// 工具方言：个人中心与聊天已落地（.dialect-tool）；/lab 实验豁免保持根作用域
	// 中性，实验样式不得反向改写正式页面 token
	const isLabRoute = pathname.startsWith("/lab");
	const shellDialect =
		isProfileRoute || isChatRoute ? "dialect-tool" : isLabRoute ? null : "dialect-public";
	// 组件库文档的示例需要中性画布，星图点缀只铺在公开内容页
	const isUiDocsRoute = pathname === "/ui" || pathname.startsWith("/ui/");
	const showBackdrop = shellDialect === "dialect-public" && !isUiDocsRoute;

	// 首次 hydration 复用 SSR claims，不一定重跑客户端 beforeLoad。
	useEffect(() => {
		if (auth.claims) markSessionActive();
	}, [auth.claims]);

	return (
		<AppProvider>
			<SystemThemeTransition />
			<RuaRouteTransition />
			{isAdminRoute ? (
				// 后台路由：完全独立的布局，不包含前台 Header/Footer
				<Outlet />
			) : (
				// 前台路由：包含 Header/Footer 的标准布局（/chat 隐藏 Footer 并锁定视口高度）
				<div
					className={cn(
						"flex min-h-screen flex-col",
						isFullscreenRoute && "h-dvh overflow-hidden",
						// 公开壳层挂 Public Content 方言；/profile 与 /chat 挂 Tool 方言；
						// /admin 独立布局不经过这里
						shellDialect,
						// 独立层叠上下文让背景点缀的负 z-index 落在壳层画布之上
						showBackdrop && "isolate",
					)}
				>
					{showBackdrop && <SiteBackdrop />}
					<AnnouncementBar />
					<Header isAuthenticated={auth.isAuthenticated} />
					<main
						className={cn(
							"flex flex-1 flex-col",
							!isFullscreenRoute && "min-h-[calc(100dvh-4rem)]",
							isFullscreenRoute && "min-h-0 overflow-hidden",
						)}
					>
						<Outlet />
					</main>
					{!isFullscreenRoute && <Footer />}
				</div>
			)}
			<DocumentScrollbar />
			<MusicPlayer />
			<CommandPalette />
			<LoginDialog />
			<LinkConfirmDialog />
			<ApiDocsDialog />
			<ShareTweetDialog />
			<CustomCursor />
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
	// color-scheme 不内联注入：light-dark() 的取值开关由 tokens 的
	// .dark 规则驱动，内联会永远压过它
	return (
		<html className={theme} lang="zh-CN" data-scrollbar="none" suppressHydrationWarning>
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
