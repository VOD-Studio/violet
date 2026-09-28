import type { ReactNode } from "react";
import { ComponentDemo } from "../ComponentDemo";
import { ButtonBasicDemo } from "../examples/button/basic";
import buttonBasicSource from "../examples/button/basic.tsx?raw";
import { GuideCode, GuideLink, GuideSection } from "./GuideParts";
import { GuidePending } from "./GuidePending";

export const INTRODUCTION_GUIDES: Record<string, ReactNode> = {
	introduction: (
		<>
			<GuideSection title="violet 的组件库">
				<p>
					<code>@violet/ui</code> 是基于 React 19、Tailwind CSS v4 与 Radix UI
					的组件库，附明暗一体的语义主题 token。营造法式是它的在线用法与设计规范，
					不是另一套组件实现。
				</p>
				<ComponentDemo code={buttonBasicSource}>
					<ButtonBasicDemo />
				</ComponentDemo>
			</GuideSection>
			<GuideSection title="核心特性">
				<ul className="list-disc space-y-2 pl-5">
					<li>
						<strong>默认即成体系</strong>：语义 token 与 Violet
						色板开箱可用，明暗主题同一套类名。
					</li>
					<li>
						<strong>无障碍基座</strong>：交互件构建在 Radix UI
						之上，焦点管理、键盘导航与屏幕阅读器语义内建。
					</li>
					<li>
						<strong>组合式部件</strong>：Dialog、Tabs
						等以根、触发器、内容部件导出，按需组合不锁死结构。
					</li>
					<li>
						<strong>完整类型化</strong>：根入口导出全部组件与变体类型，IDE 补全可用。
					</li>
					<li>
						<strong>宿主解耦</strong>：不绑定路由与主题库，由应用自带并桥接。
					</li>
				</ul>
			</GuideSection>
			<GuideSection title="常见问题">
				<ul className="space-y-2">
					<li>
						<strong>能在仓库外使用吗？</strong>能。构建产物可打包为 tarball 安装到独立
						React 19 项目；npm 发布尚未执行。
					</li>
					<li>
						<strong>支持 TypeScript 吗？</strong>完全类型化，类型声明随构建产物提供。
					</li>
					<li>
						<strong>怎么定制样式？</strong>优先用变体与语义类，主题值通过覆盖 CSS
						变量调整，见 <GuideLink to="/design-system/guides/theming">主题</GuideLink>
						。
					</li>
					<li>
						<strong>什么协议？</strong>MIT。
					</li>
				</ul>
			</GuideSection>
			<GuideSection title="下一步">
				<p>
					从 <GuideLink to="/design-system/guides/quick-start">快速入门</GuideLink>{" "}
					跑起第一个组件，或到{" "}
					<GuideLink to="/design-system/specimens">组件目录</GuideLink>
					逐个查看用法、示例与限制。
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
			<GuideSection title="Vite（已验证）">
				<p>
					在 Vite 项目的全局 CSS 先后导入 Tailwind 与包样式，即可使用全部组件；
					以下路径在仓库外的独立 React 19 + Vite 8 项目实测通过。
				</p>
				<GuideCode
					language="ts"
					title="vite.config.ts"
					code={
						'import tailwindcss from "@tailwindcss/vite";\nimport react from "@vitejs/plugin-react";\nimport { defineConfig } from "vite";\n\nexport default defineConfig({ plugins: [tailwindcss(), react()] });'
					}
				/>
				<GuideCode
					language="css"
					title="src/styles.css"
					code={'@import "tailwindcss";\n@import "@violet/ui/styles.css";'}
				/>
			</GuideSection>
			<GuideSection title="TanStack Start（已验证）">
				<p>
					本站即宿主：通过 <code>workspace:*</code> 消费包，SSR
					页面在根布局加载同一份全局样式，让首屏与客户端拿到同一套变量；把{" "}
					<code>.dark</code> 挂在 html 或共同祖先，主题持久化由应用负责，见{" "}
					<GuideLink to="/design-system/guides/dark-mode">深色模式</GuideLink>。
				</p>
				<GuideCode
					language="bash"
					title="安装（工作区）"
					code="cd web\npnpm install\npnpm dev"
				/>
			</GuideSection>
			<GuideSection title="更多框架">
				<p>以下宿主尚未验证或暂无计划，先列出方向；开放后在此补充实测步骤。</p>
				<div className="grid gap-3 sm:grid-cols-2">
					<GuidePending title="Next.js（App Router）">SSR 布局导入验证中</GuidePending>
					<GuidePending title="Remix">暂未开放</GuidePending>
					<GuidePending title="Astro">暂未开放</GuidePending>
					<GuidePending title="Storybook">暂未开放</GuidePending>
				</div>
				<p>没有 Vue/Svelte 原生组件；构建产物面向 React 19 宿主。</p>
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
};
