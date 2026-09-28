import { GuideSection } from "./GuideParts";

/** 路线图章节：已交付能力与尚未开放的能力。 */
export default function RoadmapGuide() {
	return (
		<>
			<GuideSection title="已经可用">
				<p>
					站点以 <code>workspace:*</code> 消费 <code>@violet/ui</code>，根入口与{" "}
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
	);
}
