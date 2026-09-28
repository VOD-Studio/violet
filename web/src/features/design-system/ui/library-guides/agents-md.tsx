import packageAgentRules from "../../../../../packages/ui/AGENTS.md?raw";
import { GuideCode, GuideSection } from "./GuideParts";

/** AGENTS.md 章节：包内代理规范与整仓规范的配合。 */
export default function AgentsMdGuide() {
	return (
		<GuideSection title="包内规则">
			<p>
				包中的 <code>web/packages/ui/AGENTS.md</code> 约束导出、样式归属和示例同步；根目录{" "}
				<code>AGENTS.md</code>{" "}
				继续约束整仓架构、提交和检查。下面展示包内文件原文，更新文件即可同步本页。
			</p>
			<GuideCode
				language="markdown"
				title="web/packages/ui/AGENTS.md"
				code={packageAgentRules}
			/>
		</GuideSection>
	);
}
