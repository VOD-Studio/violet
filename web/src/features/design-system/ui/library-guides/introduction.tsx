import { CodeCard } from "@shared/ui/code-preview/components/CodeCard";
import { ButtonBasicDemo } from "../examples/button/basic";
import buttonBasicSource from "../examples/button/basic.tsx?raw";
import { GuideLink, GuideSection } from "./GuideParts";

/** 介绍章节：组件库定位、核心特性与常见问题。 */
export default function IntroductionGuide() {
	return (
		<>
			<GuideSection title="violet 的组件库">
				<p>
					<code>@violet/ui</code> 是基于 React 19、Tailwind CSS v4 与 Radix UI
					的组件库，附明暗一体的语义主题 token。营造法式是它的在线用法与设计规范，
					不是另一套组件实现。
				</p>
				<CodeCard
					code={buttonBasicSource}
					language="tsx"
					variant="light"
					lineNumbers
					collapseLines={6}
				>
					<ButtonBasicDemo />
				</CodeCard>
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
	);
}
