import guideSource from "./content/agents-md.md?raw";
import { MarkdownGuideDoc } from "./markdown-guide";

/** AGENTS.md 章节：包内代理规范与整仓规范的配合。 */
export default function AgentsMdGuide() {
	return <MarkdownGuideDoc source={guideSource} />;
}
