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
					<code>@violet/ui</code> 是可构建并打包分发的 React 组件库。Button、Dialog、 Tabs
					等组件从根入口导出；主题由独立 CSS 入口提供。营造法式是在线用法与设计规范，
					不是另一套组件实现。
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
					包构建后提供 ESM JavaScript、类型声明和 CSS，可在仓库外通过构建产物 tarball
					安装。 当前未发布到 npm；React 19 与 Tailwind CSS v4
					是宿主要求，包不提供独立主题 Provider。
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
			<GuideSection title="在工作区安装">
				<p>
					包以 pnpm workspace 方式消费，<code>web/package.json</code> 已用{" "}
					<code>workspace:*</code> 声明 <code>@violet/ui</code>；站点开发无需安装产物。
				</p>
				<GuideCode language="bash" code="cd web\npnpm install\npnpm dev" />
				<p>
					仓库外的独立项目可安装构建产物 tarball（见{" "}
					<GuideLink to="/design-system/guides/cli">命令行</GuideLink>
					）；当前不发布 npm 包。
				</p>
			</GuideSection>
			<GuideSection title="接入样式">
				<p>
					在应用唯一的全局 CSS 入口导入；Tailwind 必须先于包样式。打包 CSS 注册 token、
					默认 Violet 色板和用于扫描已编译组件类名的 Tailwind v4
					@source；站点方言和字体仍由应用控制。
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
					站点与同仓库应用通过 <code>workspace:*</code> 消费源码入口；仓库外的 React
					19、Tailwind CSS v4 项目安装构建 tarball 后，同样从 <code>@violet/ui</code>{" "}
					导入组件、从 <code>@violet/ui/styles.css</code> 导入样式——tarball 内的 exports
					指向 dist 的 ESM、类型声明和 CSS，外部项目不需要转译包内 TSX 源码。
				</p>
				<p>
					SSR 页面要在根布局加载全局样式，让首屏和客户端拿到同一套变量。把{" "}
					<code>.dark</code> 挂在 html 或共同祖先；包不负责管理主题持久化。详见{" "}
					<GuideLink to="/design-system/guides/dark-mode">深色模式</GuideLink>。
				</p>
			</GuideSection>
			<GuideSection title="其他框架的边界">
				<p>
					构建产物可作为 tarball 在其他 React 19 项目中安装；目前没有 Vue/Svelte
					原生组件。其他 SSR 框架应在根布局加载全局样式，并自行管理主题持久化。
				</p>
			</GuideSection>
		</>
	),
	cli: (
		<>
			<GuideSection title="构建与打包">
				<p>
					仓库没有独立的 <code>violet-ui</code> 安装 CLI。使用 pnpm 构建并打包
					<code>@violet/ui</code>；发布到 scoped npm registry 是未来的人工操作，
					当前请安装 tarball，而非直接运行 <code>pnpm add @violet/ui</code>。
				</p>
				<GuideCode
					language="bash"
					code="cd web\npnpm install --frozen-lockfile\npnpm --filter @violet/ui build\npnpm --filter @violet/ui pack --pack-destination /tmp"
				/>
				<p>
					开发站点仍使用 <code>pnpm dev</code>；命令定义以各 package.json 为准。
				</p>
			</GuideSection>
		</>
	),
	roadmap: (
		<>
			<GuideSection title="已经可用">
				<p>
					站点以 <code>workspace:*</code> 消费 <code>@violet/ui</code>， 根入口与{" "}
					<code>@violet/ui/styles.css</code> 主题入口、明暗语义 token 已就位；
					<code>pnpm --filter @violet/ui build</code> 产出 ESM、类型声明与打包 CSS，可压成
					tarball 在仓库外安装验证。
				</p>
			</GuideSection>
			<GuideSection title="尚未开放">
				<p>
					scoped npm registry 发布、专用的组件文档 MCP server、用于安装组件的专用 CLI
					尚未提供。需要这些能力时先补齐实际服务，再更新接入说明。
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
