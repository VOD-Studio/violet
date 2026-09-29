import guideSource from "./content/roadmap.md?raw";
import { MarkdownGuideDoc } from "./markdown-guide";

/** 版本记录章节：发布节奏、各版本能力变更与尚未开放的能力。 */
export default function RoadmapGuide() {
	return <MarkdownGuideDoc source={guideSource} />;
}
