import { Toaster } from "@shared/ui/sonner";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { createQueryClient } from "./query-client";

const queryClient = createQueryClient();

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
 * - QueryClientProvider：服务端状态（TanStack Query）
 * - ThemeProvider（next-themes）：双主题，cookie 持久化防 FOUC
 * - Toaster：全局错误/成功 toast（接 QueryCache error）
 */
const AppProvider = ({ children }: AppProviderProps) => {
	return (
		<QueryClientProvider client={queryClient}>
			<ThemeProvider
				attribute="class"
				defaultTheme="system"
				disableTransitionOnChange
			>
				{children}
				<Toaster />
			</ThemeProvider>
		</QueryClientProvider>
	);
};

export default AppProvider;
