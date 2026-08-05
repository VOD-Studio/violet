import { GoogleOAuthProvider } from "@react-oauth/google";
import { Toaster } from "@shared/ui/base/sonner";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { clientQueryClient } from "./query-client";

/**
 * AppProviderProps
 */
export interface AppProviderProps {
	/**
	 * 应用子节点
	 */
	children: ReactNode;
}

/**
 * AppProvider - 全局 Provider 装配
 *
 * 集中装配所有跨路由 Provider，避免 __root 组件膨胀：
 * - QueryClientProvider：服务端状态（TanStack Query），复用 clientQueryClient 单例
 *   （与 http 拦截器等非组件代码共用同一实例，避免缓存串扰）
 * - ThemeProvider（next-themes）：双主题，cookie 持久化防 FOUC
 * - Toaster：全局错误/成功 toast（接 QueryCache error）
 * - GoogleOAuthProvider: Google 登录
 */
const AppProvider = ({ children }: AppProviderProps) => {
	// 如果没有配置 client_id，传入一个占位符避免 @react-oauth/google 抛出致命错误崩溃。
	// 在具体使用的地方（如 LoginDialog），我们可以通过判断环境变量来禁用相关按钮。
	const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "missing_client_id";

	return (
		<GoogleOAuthProvider clientId={googleClientId}>
			<QueryClientProvider client={clientQueryClient}>
				<ThemeProvider attribute="class" defaultTheme="system">
					{children}
					<Toaster />
				</ThemeProvider>
			</QueryClientProvider>
		</GoogleOAuthProvider>
	);
};

export default AppProvider;
