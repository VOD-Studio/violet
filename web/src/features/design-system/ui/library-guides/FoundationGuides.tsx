import { Button } from "@violet/ui";
import type { ReactNode } from "react";
import { GuideCode, GuideLink, GuideSection } from "./GuideParts";

export const FOUNDATION_GUIDES: Record<string, ReactNode> = {
	colors: (
		<>
			<GuideSection title="先选语义，再选色值">
				<p>
					用 <code>bg-background text-foreground</code> 表示页面，用{" "}
					<code>bg-card text-card-foreground</code> 表示卡片。主要动作使用{" "}
					<code>primary</code>；强调品牌时使用 <code>brand</code>
					。危险、警示、成功分别使用各自的状态 token，不挪用品牌色。
				</p>
				<div className="grid gap-3 sm:grid-cols-3">
					<div className="rounded-lg border border-border bg-card p-4 text-card-foreground">
						卡片 · card
					</div>
					<div className="rounded-lg bg-brand p-4 text-brand-foreground">
						品牌 · brand
					</div>
					<div className="rounded-lg bg-muted p-4 text-muted-foreground">
						弱背景 · muted
					</div>
				</div>
				<p>
					成对使用背景和 foreground；文本对比度需满足 WCAG AA。查询当前主题下的真实值到{" "}
					<GuideLink to="/design-system/tokens">Token 词典</GuideLink>，更换品牌色到{" "}
					<GuideLink to="/design-system/palette">色板生成器</GuideLink>。
				</p>
			</GuideSection>
		</>
	),
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
	animation: (
		<>
			<GuideSection title="反馈的优先级">
				<p>
					悬停和选中优先调整颜色、描边和透明度。普通弹层的进入无需放大或方向位移；确实有空间来源的手势才采用位移。组件加载态不应使文案或布局跳变。
				</p>
				<div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-5">
					<Button>正常</Button>
					<Button loading>加载中</Button>
					<Button disabled>不可用</Button>
				</div>
				<p>
					尊重 <code>prefers-reduced-motion</code>；时间与场景的取舍见{" "}
					<GuideLink to="/design-system/motion">动效章程</GuideLink>。
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
	"agentic-ui": (
		<>
			<GuideSection title="用现有组件呈现代理操作">
				<p>
					库没有专门的 Agent UI 协议组件。已有 <code>Button loading</code>{" "}
					可表达处理中并阻止重复点击，<code>Dialog</code> 可承载需人工确认的操作，
					<code>Input</code>{" "}
					可收集补充信息。代理输出的内容、权限校验和执行结果仍由业务层管理。
				</p>
				<GuideCode
					code={
						'import { Button } from "@violet/ui";\n\n<Button type="button" loading={isSubmitting} onClick={submitApprovedAction}>\n  确认执行\n</Button>'
					}
				/>
				<p>
					实际执行前展示目标与影响范围；失败时保留可读错误与重新操作路径，不用只剩旋转图标的状态代替结果。需要对话式展示时使用业务
					feature，不将聊天业务逻辑塞进 <code>@violet/ui</code>。
				</p>
			</GuideSection>
		</>
	),
};
