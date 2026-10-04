import guideSource from "./content/composition.md?raw";
import { MarkdownGuideDoc } from "./markdown-guide";

/** 组合章节：asChild、部件组合与框架无关的样式。 */
export default function CompositionGuide() {
	return <MarkdownGuideDoc source={guideSource} />;
}
