import { CustomEmojiContextMenu } from "@features/customemoji/ui/CustomEmojiContextMenu";
import { useSettings } from "@features/settings/api/queries";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { RunnableCodeContext } from "@shared/ui/markdown-preview/code-renderer-context";
import { Toaster, type VioletToasterProps } from "@violet/ui";
import { ThemeProvider, useTheme } from "next-themes";
import { lazy, type ReactNode } from "react";

const CodeRunner = lazy(() =>
	import("@entities/code-runner/ui/CodeRunner").then((module) => ({
		default: module.CodeRunner,
	})),
);

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
 * 站点主题桥接的 toast 容器：@violet/ui 不绑定主题库，
 * 由宿主把 next-themes 当前值传给 Toaster。
 */
function ThemedToaster() {
	const { theme } = useTheme();
	return <Toaster theme={theme as VioletToasterProps["theme"]} />;
}

/**
 * 站点级主题、OAuth、toast 与表情交互。
 * 查询缓存由外层 Router–Query SSR 集成提供。
 */
const AppProvider = ({ children }: AppProviderProps) => {
	return (
		<GoogleOAuthGate>
			<ThemeProvider attribute="class" defaultTheme="system" enableColorScheme={false}>
				<RunnableCodeContext value={CodeRunner}>
					<CustomEmojiContextMenu>{children}</CustomEmojiContextMenu>
				</RunnableCodeContext>
				<ThemedToaster />
			</ThemeProvider>
		</GoogleOAuthGate>
	);
};

export default AppProvider;
