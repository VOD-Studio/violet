import { GuideCode, GuideLink, GuideSection } from "./GuideParts";

/** 快速入门章节：安装、接入样式与第一个组件。 */
export default function QuickStartGuide() {
	return (
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
	);
}
