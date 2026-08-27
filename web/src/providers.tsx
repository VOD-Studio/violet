import { CustomEmojiContextMenu } from "@features/customemoji/ui/CustomEmojiContextMenu";
import { useSettings } from "@features/settings/api/queries";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { clientQueryClient } from "@shared/api/query-client";
import { Toaster } from "@shared/ui/base/sonner";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

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
 * 从站点公开配置取实时 Google client_id 的 Provider 门卫。
 *
 * client_id 是公开值且后台可写，写入后无需重新构建前端即生效；
 * settings 未加载/未配置时回退构建期 env，两者皆空时传占位符避免
 * @react-oauth/google 抛致命错误（按钮由 useOAuthVisibility 隐藏）。
 */
function GoogleOAuthGate({ children }: { children: ReactNode }) {
	const { data: settings } = useSettings();
	const clientId =
		settings?.google_client_id || import.meta.env.VITE_GOOGLE_CLIENT_ID || "missing_client_id";
	return <GoogleOAuthProvider clientId={clientId}>{children}</GoogleOAuthProvider>;
}

/**
 * 全局 Provider 装配（集中于此避免 __root 组件膨胀）：
 * - QueryClientProvider：服务端状态（TanStack Query），复用 clientQueryClient 单例
 *   （与 http 拦截器等非组件代码共用同一实例，避免缓存串扰）
 * - GoogleOAuthProvider: Google 登录（clientId 实时取自公开 settings，需在
 *   QueryClientProvider 内部以使用 useSettings）
 * - ThemeProvider（next-themes）：双主题，cookie 持久化防 FOUC
 * - Toaster：全局错误/成功 toast（接 QueryCache error）
 */
const AppProvider = ({ children }: AppProviderProps) => {
	return (
		<QueryClientProvider client={clientQueryClient}>
			<GoogleOAuthGate>
				<ThemeProvider attribute="class" defaultTheme="system">
					<CustomEmojiContextMenu>{children}</CustomEmojiContextMenu>
					<Toaster />
				</ThemeProvider>
			</GoogleOAuthGate>
		</QueryClientProvider>
	);
};

export default AppProvider;
