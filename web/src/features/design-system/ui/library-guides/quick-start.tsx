import { CodeCard } from "@shared/ui/code-preview/components/CodeCard";
import { ButtonBasicDemo } from "../examples/button/basic";
import buttonBasicSource from "../examples/button/basic.tsx?raw";
import { GuideCode, GuideLink, GuideSection } from "./GuideParts";

/** 快速入门章节：环境要求、安装、导入样式、第一个组件与下一步。 */
export default function QuickStartGuide() {
	return (
		<>
			<GuideSection title="环境要求">
				<ul className="list-disc space-y-2 pl-5">
					<li>React 19 及以上</li>
					<li>react-dom 19 及以上</li>
					<li>Tailwind CSS v4</li>
				</ul>
			</GuideSection>
			<GuideSection title="安装">
				<p>
					工作区内开发无需安装动作：<code>web/package.json</code> 已用{" "}
					<code>workspace:*</code> 声明 <code>@violet/ui</code>，装好依赖即可使用。
				</p>
				<GuideCode language="bash" code="cd web\npnpm install\npnpm dev" />
				<p>独立项目安装构建产物：先打包 tarball，再在目标项目安装（当前未发布 npm）。</p>
				<GuideCode
					language="bash"
					code={
						"cd web\npnpm --filter @violet/ui build\npnpm --filter @violet/ui pack --pack-destination /tmp\n\n# 在目标项目根目录\ncp /tmp/violet-ui-<version>.tgz .\npnpm add ./violet-ui-<version>.tgz"
					}
				/>
			</GuideSection>
			<GuideSection title="导入样式">
				<p>将以下内容添加到应用的主 CSS 文件：</p>
				<GuideCode
					language="css"
					title="src/styles.css"
					code={'@import "tailwindcss";\n@import "@violet/ui/styles.css";'}
				/>
				<p>
					导入顺序很重要：务必先导入 <code>tailwindcss</code>
					。包样式中的 <code>@theme inline</code> 映射与 <code>@source</code>{" "}
					组件类名扫描都依赖 Tailwind 先建立编译上下文。
				</p>
			</GuideSection>
			<GuideSection title="使用组件">
				<CodeCard code={buttonBasicSource} language="tsx" lineNumbers collapseLines={6}>
					<ButtonBasicDemo />
				</CodeCard>
				<GuideCode
					code={
						'import { Button } from "@violet/ui";\n\nexport function SaveAction() {\n  return <Button type="button" onClick={() => console.log("saved")}>保存</Button>;\n}'
					}
				/>
				<p>
					按钮执行导航时用 <code>asChild</code> 包裹真实链接；纯图标按钮添加{" "}
					<code>aria-label</code>。完整行为与加载态见{" "}
					<GuideLink to="/design-system/specimens/button">Button 用法页</GuideLink>。
				</p>
			</GuideSection>
			<GuideSection title="下一步">
				<ul className="space-y-2">
					<li>
						<GuideLink to="/design-system/guides/theming">主题</GuideLink>
						——通过 CSS 变量定制色板与语义 token。
					</li>
					<li>
						<GuideLink to="/design-system/specimens">浏览组件</GuideLink>
						——查看所有可用组件的用法与限制。
					</li>
					<li>
						<GuideLink to="/design-system/guides/styling">学习样式</GuideLink>
						——用变体与 Tailwind 工具类自定义外观。
					</li>
					<li>
						<GuideLink to="/design-system/guides/composition">探索组合模式</GuideLink>
						——掌握 asChild 与复合部件。
					</li>
				</ul>
			</GuideSection>
		</>
	);
}
