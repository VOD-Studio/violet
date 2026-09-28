import type { ReactNode } from "react";
import { ComponentDemo } from "../ComponentDemo";
import { ButtonBasicDemo } from "../examples/button/basic";
import buttonBasicSource from "../examples/button/basic.tsx?raw";
import { GuideCode, GuideLink, GuideSection } from "./GuideParts";

export const INTRODUCTION_GUIDES: Record<string, ReactNode> = {
	introduction: (
		<>
			<GuideSection title="先用包，再查法式">
				<p>
					<code>@violet/ui</code> 是仓库的 React 组件工作区包。Button、Dialog、Tabs
					等组件有统一的根导出；颜色与明暗主题由包的 CSS
					入口提供。营造法式是这个包的在线用法与设计规范，不是另一套组件实现。
				</p>
				<ComponentDemo code={buttonBasicSource}>
					<ButtonBasicDemo />
				</ComponentDemo>
				<p>
					预览和复制的代码出自同一示例文件。继续阅读{" "}
					<GuideLink to="/design-system/guides/quick-start">快速入门</GuideLink>
					，或直接查看 <GuideLink to="/design-system/specimens">组件目录</GuideLink>。
				</p>
			</GuideSection>
			<GuideSection title="当前使用范围">
				<p>
					组件库由 pnpm workspace 内的站点消费。包仍为 private，JavaScript 出口直接指向
					TypeScript 源码；没有 npm 发布物、跨仓库安装命令或独立的主题 Provider。React 19
					与 Tailwind CSS v4 是当前已验证的宿主组合。
				</p>
				<p>
					选择动作语义、色彩和排版时查{" "}
					<GuideLink to="/design-system/principles">设计原则</GuideLink> 与{" "}
					<GuideLink to="/design-system/decisions">快速决策表</GuideLink>
					；不要把站点业务模块里的组件当作包的公开导出。
				</p>
			</GuideSection>
		</>
	),
	"quick-start": (
		<>
			<GuideSection title="安装工作区依赖">
				<p>
					在 violet 仓库中执行；<code>web/package.json</code> 已用{" "}
					<code>workspace:*</code> 声明 <code>@violet/ui</code>
					。此处不使用公网包管理器地址。
				</p>
				<GuideCode
					language="bash"
					code="cd web\npnpm install --frozen-lockfile\npnpm dev"
				/>
			</GuideSection>
			<GuideSection title="接入样式">
				<p>
					在应用唯一的全局 CSS 入口导入；Tailwind 必须先于包样式。包入口注册 token、默认
					Violet 色板及 Tailwind 组件类扫描，站点方言和字体仍由应用控制。
				</p>
				<GuideCode
					language="css"
					title="src/styles.css"
					code={'@import "tailwindcss";\n@import "@violet/ui/styles.css";'}
				/>
			</GuideSection>
			<GuideSection title="使用组件">
				<GuideCode
					code={
						'import { Button } from "@violet/ui";\n\nexport function SaveAction() {\n  return <Button type="button" onClick={() => console.log("saved")}>保存</Button>;\n}'
					}
				/>
				<p>
					如果按钮执行导航，使用 <code>asChild</code> 包裹真实链接；纯图标按钮添加{" "}
					<code>aria-label</code>。完整行为与加载态见{" "}
					<GuideLink to="/design-system/specimens/button">Button 用法页</GuideLink>。
				</p>
			</GuideSection>
		</>
	),
	integration: (
		<>
			<GuideSection title="React 与构建器">
				<p>
					当前包通过 pnpm workspace 由 React 19、Vite/TanStack Start
					应用直接消费。JavaScript 从 <code>@violet/ui</code> 导入，CSS 从{" "}
					<code>@violet/ui/styles.css</code> 导入；入口分别在包的 exports 中声明。
				</p>
				<GuideCode
					language="json"
					title="web/package.json（依赖片段）"
					code={'{"dependencies": {"@violet/ui": "workspace:*"}}'}
				/>
				<p>
					SSR 页面要在根布局加载全局样式，让首屏和客户端拿到同一套变量。把{" "}
					<code>.dark</code> 挂在 html 或共同祖先；包不负责管理主题持久化。详见{" "}
					<GuideLink to="/design-system/guides/dark-mode">深色模式</GuideLink>。
				</p>
			</GuideSection>
			<GuideSection title="其他框架的边界">
				<p>
					当前包的 JavaScript 出口是 TSX 源码，并未生成可发布的 ESM 与类型声明。Next.js
					等仓库外消费方不能按 npm 安装流程直接接入，也没有 Vue/Svelte
					原生组件；请以仓库内的 Vite 应用作为可验证的用法。
				</p>
			</GuideSection>
		</>
	),
	cli: (
		<>
			<GuideSection title="工作区命令">
				<p>
					仓库没有独立的 <code>violet-ui</code> CLI。安装、开发、路由生成和验证使用已有
					pnpm 脚本，不要运行 HeroUI 的 <code>heroui-cli</code> 给这个包加组件。
				</p>
				<GuideCode
					language="bash"
					code="cd web\npnpm install --frozen-lockfile\npnpm generate-routes\npnpm dev\npnpm typecheck\npnpm check"
				/>
				<p>
					命令声明见 <code>web/package.json</code>；运行时依赖 API 的页面仍按根 Makefile
					启动完整开发环境。
				</p>
			</GuideSection>
		</>
	),
	examples: (
		<>
			<GuideSection title="现场预览">
				<p>
					下面的按钮可点击。展示代码直接读取运行这个按钮的示例文件，避免预览与代码分叉。
				</p>
				<ComponentDemo code={buttonBasicSource}>
					<ButtonBasicDemo />
				</ComponentDemo>
			</GuideSection>
			<GuideSection title="按任务找示例">
				<ul className="list-disc space-y-2 pl-5">
					<li>
						<GuideLink to="/design-system/specimens/button">Button</GuideLink>
						：动作层级、链接、加载中。
					</li>
					<li>
						<GuideLink to="/design-system/specimens/dialog">Dialog</GuideLink>
						：确认与关闭。
					</li>
					<li>
						<GuideLink to="/design-system/specimens/input">Input</GuideLink>：受控输入。
					</li>
					<li>
						<GuideLink to="/design-system/specimens/tabs">Tabs</GuideLink>
						：分栏切换与键盘操作。
					</li>
				</ul>
			</GuideSection>
		</>
	),
	roadmap: (
		<>
			<GuideSection title="已经可用">
				<p>
					pnpm 工作区内的 <code>@violet/ui</code> 根导出、
					<code>@violet/ui/styles.css</code> 主题入口、明暗语义
					token，以及营造法式里的可操作组件示例。
				</p>
			</GuideSection>
			<GuideSection title="尚未开放">
				<p>
					独立 npm 发布、包级构建和类型产物、专用的组件文档 MCP server、Figma
					组件资产，以及用于安装组件的专用 CLI
					均未提供。本文不对这些能力承诺发布时间；需要它们时先补齐实际产物，再更新接入说明。
				</p>
			</GuideSection>
		</>
	),
	figma: (
		<>
			<GuideSection title="可复用的设计资产">
				<p>
					仓库当前没有可下载的 Violet Figma 组件文件，不能把 HeroUI 的 Figma Kit
					当成本站组件资源。颜色的可复制真相在{" "}
					<GuideLink to="/design-system/palette">色板生成器</GuideLink> 与{" "}
					<GuideLink to="/design-system/tokens">Token 词典</GuideLink>：按主题复制 CSS
					变量后可在设计文件里维护同名变量。
				</p>
				<p>
					按钮、徽章、复选框的状态与尺寸以各自的{" "}
					<GuideLink to="/design-system/specimens">组件用法页</GuideLink>{" "}
					为准；手工设计稿不构成运行时组件导出。
				</p>
			</GuideSection>
		</>
	),
	handbook: (
		<>
			<GuideSection title="照什么做">
				<ul className="list-disc space-y-2 pl-5">
					<li>
						选择颜色：先查{" "}
						<GuideLink to="/design-system/decisions">快速决策表</GuideLink>，再查{" "}
						<GuideLink to="/design-system/tokens">Token 词典</GuideLink>。
					</li>
					<li>
						写页面：对照 <GuideLink to="/design-system/layout">布局规格</GuideLink> 和{" "}
						<GuideLink to="/design-system/motion">动效章程</GuideLink>。
					</li>
					<li>
						调用组件：先看 <GuideLink to="/design-system/specimens">组件目录</GuideLink>
						，再看具体组件的导入、示例与限制。
					</li>
				</ul>
			</GuideSection>
			<GuideSection title="设计底线">
				<p>
					语义 token 优先、正文与底色保持 WCAG AA 对比；功能圆角最大{" "}
					<code>rounded-2xl</code>
					，浮起仅用轻软影。常规反馈用颜色、描边、透明度，不靠缩放或方向位移动效。具体判据见{" "}
					<GuideLink to="/design-system/principles">设计原则</GuideLink>。
				</p>
			</GuideSection>
		</>
	),
};
