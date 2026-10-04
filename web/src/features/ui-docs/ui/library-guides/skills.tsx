import guideSource from "./content/skills.md?raw";
import { MarkdownGuideDoc } from "./markdown-guide";

/** Agent Skills 章节：随仓库分发的编码技能入口。 */
export default function SkillsGuide() {
	return <MarkdownGuideDoc source={guideSource} />;
}
