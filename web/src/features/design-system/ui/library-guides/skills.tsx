import { GuideCode, GuideSection } from "./GuideParts";

/** Agent Skills 章节：随仓库分发的编码技能入口。 */
export default function SkillsGuide() {
	return (
		<GuideSection title="随仓库分发的技能">
			<p>
				项目内 <code>.agents/skills/violet-ui/SKILL.md</code>{" "}
				规定包导出、样式导入、示例同源和浏览器核对顺序；
				<code>frontend-conventions</code> 管文件落位，
				<code>tailwind-canonical-classes</code> 管 Tailwind
				类名。它们随仓库提供，无需外部安装脚本。
			</p>
			<GuideCode
				language="bash"
				code="cd web\npnpm dev\n# 访问 /design-system/specimens 查看真实组件示例"
			/>
			<p>在本仓库内让编码智能体按规则调用这几个 skill；仓库外暂不提供可安装的技能包。</p>
		</GuideSection>
	);
}
