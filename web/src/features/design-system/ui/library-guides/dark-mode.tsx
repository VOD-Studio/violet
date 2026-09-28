import { GuideCode, GuideSection } from "./GuideParts";

/** 深色模式章节：祖先类切换与宿主职责。 */
export default function DarkModeGuide() {
	return (
		<GuideSection title="通过祖先类切换">
			<p>
				主题入口为 <code>:root</code> 提供浅色值，为 <code>.dark</code> 提供暗色值。库不注入
				JS 主题管理。本站在根 Provider 使用 <code>next-themes</code> 的{" "}
				<code>attribute="class"</code> 和 <code>defaultTheme="system"</code>，它把 dark
				类挂到 html。
			</p>
			<GuideCode
				code={
					'import { ThemeProvider } from "next-themes";\n\n<ThemeProvider attribute="class" defaultTheme="system">\n  <App />\n</ThemeProvider>'
				}
			/>
			<p>
				SSR 页面需要在首屏同步主题类，避免 hydration 前背景闪烁。本站由应用持久化主题
				cookie；这一流程不由 <code>@violet/ui</code> 自动完成。
			</p>
		</GuideSection>
	);
}
