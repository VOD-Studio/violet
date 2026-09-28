import { GuideLink, GuideSection } from "./GuideParts";

/** 版本记录章节：发布节奏、各版本能力变更与尚未开放的能力。 */
export default function RoadmapGuide() {
	return (
		<>
			<GuideSection title="发布节奏">
				<ul className="space-y-2">
					<li>
						<strong>0.x 阶段</strong>：能力随仓库演进按小版本推进，包版本记录在{" "}
						<code>web/packages/ui/package.json</code>。
					</li>
					<li>
						<strong>分发形态</strong>：站点经 <code>workspace:*</code>{" "}
						消费源码；独立项目安装构建 tarball，npm 发布尚未执行。
					</li>
					<li>
						<strong>文档同步</strong>：组件用法页与示例同源，版本落地时随代码同 commit
						更新。
					</li>
				</ul>
			</GuideSection>
			<GuideSection title="v0.1.0">
				<p className="text-sm text-muted-foreground">2026 年 9 月 28 日</p>
				<p>
					首个成册版本：40+ 通用组件从站点公共层迁入 pnpm 工作区包，变体系统迁移到{" "}
					<code>tailwind-variants</code>，语义主题（基础 token、Violet 色板、Tailwind
					映射）随 <code>@violet/ui/styles.css</code> 入口随包分发；新增独立构建链，产出
					ESM、类型声明与打包 CSS，可压成 tarball
					在仓库外安装验证。营造法式同步改造为组件库文档站。
				</p>
				<ul className="list-disc space-y-2 pl-5">
					<li>
						新增构建产物三件套：<code>pnpm --filter @violet/ui build</code> 产出 dist
						下的 ESM、类型声明与单文件主题 CSS。
					</li>
					<li>
						宿主解耦：Toaster 改为主题透传（不再依赖 next-themes），Segmented 移除
						TanStack Router 耦合，OverlayScroll 与 chart 消除运行时 CSS 与 innerHTML
						注入。
					</li>
					<li>
						文档站五卷成册：入门、纲纪准则、设计法度、构件陈列、智能体，正文按章节路由化并懒加载。
					</li>
					<li>
						组件用法页覆盖 Button、Badge、Checkbox、Dialog、Tabs、Input，见{" "}
						<GuideLink to="/design-system/specimens">组件目录</GuideLink>。
					</li>
				</ul>
			</GuideSection>
			<GuideSection title="尚未开放">
				<ul className="list-disc space-y-2 pl-5">
					<li>scoped npm registry 发布与版本化 CHANGELOG。</li>
					<li>专用的组件文档 MCP server。</li>
					<li>用于初始化与安装组件的专用 CLI。</li>
					<li>Figma 组件资产。</li>
				</ul>
				<p>需要这些能力时先补齐实际产物，再更新接入说明。</p>
			</GuideSection>
		</>
	);
}
