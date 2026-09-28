import { GuideCode, GuideSection } from "./GuideParts";

/** 命令行章节：无专用 CLI，给出工作区与构建打包命令。 */
export default function CliGuide() {
	return (
		<GuideSection title="构建与打包">
			<p>
				仓库没有独立的 <code>violet-ui</code> 安装 CLI。使用 pnpm 构建并打包
				<code>@violet/ui</code>；发布到 scoped npm registry 是未来的人工操作， 当前请安装
				tarball，而非直接运行 <code>pnpm add @violet/ui</code>。
			</p>
			<GuideCode
				language="bash"
				code="cd web\npnpm install --frozen-lockfile\npnpm --filter @violet/ui build\npnpm --filter @violet/ui pack --pack-destination /tmp"
			/>
			<p>
				开发站点仍使用 <code>pnpm dev</code>；命令定义以各 package.json 为准。
			</p>
		</GuideSection>
	);
}
