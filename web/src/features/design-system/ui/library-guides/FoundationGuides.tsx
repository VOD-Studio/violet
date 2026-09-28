import type { ReactNode } from "react";
import { GuideCode, GuideLink, GuideSection } from "./GuideParts";

export const FOUNDATION_GUIDES: Record<string, ReactNode> = {
	theming: (
		<>
			<GuideSection title="包的主题入口">
				<p>
					<code>@violet/ui/styles.css</code> 包含语义 token、Tailwind{" "}
					<code>@theme inline</code> 映射与默认 Violet 色板；应用必须先导入 Tailwind v4。
					<code>@theme inline</code>{" "}
					让工具类在所在作用域读取当前变量，而非将颜色固化在根元素。
				</p>
				<GuideCode
					language="css"
					code={
						'@import "tailwindcss";\n@import "@violet/ui/styles.css";\n\n/* 在包样式之后覆盖品牌色，不覆盖行为状态色 */\n:root { --brand: oklch(0.53 0.205 286); }\n.dark { --brand: oklch(0.72 0.148 286); }'
					}
				/>
			</GuideSection>
			<GuideSection title="站点方言">
				<p>
					组件库只提供默认值。本站的 <code>dialect-public</code> 将主要动作映射到品牌色，
					<code>dialect-tool</code> 保留中性主要动作；它们是 web
					应用的样式，不随库发布。消费方可以在自己的 CSS
					作用域覆盖同名语义变量。覆盖后检查文字对比度，尤其是{" "}
					<code>--brand-foreground</code>。
				</p>
			</GuideSection>
		</>
	),
	"dark-mode": (
		<>
			<GuideSection title="通过祖先类切换">
				<p>
					主题入口为 <code>:root</code> 提供浅色值，为 <code>.dark</code>{" "}
					提供暗色值。库不注入 JS 主题管理。本站在根 Provider 使用{" "}
					<code>next-themes</code> 的 <code>attribute="class"</code> 和{" "}
					<code>defaultTheme="system"</code>，它把 dark 类挂到 html。
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
		</>
	),
	styling: (
		<>
			<GuideSection title="职责顺序">
				<p>
					先通过组件的 <code>variant</code>/<code>size</code> 选择语义，再用{" "}
					<code>className</code> 调整布局；主题级色值放在 CSS
					变量。不要为单个按钮覆写变体色，让同一动作在不同方言下失去含义。
				</p>
				<GuideCode
					code={
						'import { Button } from "@violet/ui";\n\n<Button variant="brand" size="sm" className="w-full">保存</Button>'
					}
				/>
				<p>
					Tailwind v4 间距以 4px 为单位，例如 88px 用 <code>w-22</code>。功能性圆角最大{" "}
					<code>rounded-2xl</code>；浮起只用轻软影或边界描边。具体数值见{" "}
					<GuideLink to="/design-system/layout">布局规格</GuideLink>。
				</p>
			</GuideSection>
		</>
	),
	composition: (
		<>
			<GuideSection title="保留元素语义">
				<p>
					<code>Button asChild</code> 使用 Radix Slot
					将外观传给唯一子元素。导航仍是链接，提交仍是原生按钮。不要把按钮外观等同于按钮行为。
				</p>
				<GuideCode
					code={
						'import { Button } from "@violet/ui";\nimport { Link } from "@tanstack/react-router";\n\n<Button asChild variant="outline">\n  <Link to="/design-system/specimens">查看组件</Link>\n</Button>'
					}
				/>
			</GuideSection>
			<GuideSection title="按部件组合">
				<p>
					Dialog 和 Tabs
					导出可组合的根、触发器、内容部件。组合必须保留标题、焦点和键盘行为；完整用法看{" "}
					<GuideLink to="/design-system/specimens/dialog">Dialog</GuideLink> 与{" "}
					<GuideLink to="/design-system/specimens/tabs">Tabs</GuideLink> 的示例。
				</p>
			</GuideSection>
		</>
	),
};
