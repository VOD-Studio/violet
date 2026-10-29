import { CustomEmojiContextMenu } from "@features/customemoji/ui/CustomEmojiContextMenu";
import { RunnableCodeLoaderContext } from "@shared/ui/markdown-preview/code-renderer-context";
import { Toaster, type VioletToasterProps } from "@violet/ui";
import { ThemeProvider, useTheme } from "next-themes";
import type { ReactNode } from "react";

const loadCodeRunner = () =>
	import("@entities/code-runner/ui/CodeRunner").then((module) => ({
		default: module.CodeRunner,
	}));

/** 全站外观和轻量交互的挂载范围，不包含登录 SDK。 */
export interface AppProviderProps {
	children: ReactNode;
}

/** 将站点外观传给不绑定 next-themes 的 toast 容器。 */
function AppearanceToaster() {
	const { theme: appearance } = useTheme();
	return <Toaster theme={appearance as VioletToasterProps["theme"]} />;
}

/**
 * 站点级外观、toast 与表情交互。
 * 查询缓存由外层 Router–Query SSR 集成提供。
 */
const AppProvider = ({ children }: AppProviderProps) => {
	return (
		<ThemeProvider attribute="class" defaultTheme="system" enableColorScheme={false}>
			<RunnableCodeLoaderContext value={loadCodeRunner}>
				<CustomEmojiContextMenu>{children}</CustomEmojiContextMenu>
			</RunnableCodeLoaderContext>
			<AppearanceToaster />
		</ThemeProvider>
	);
};

export default AppProvider;
