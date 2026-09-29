import guideSource from "./content/styling.md?raw";
import { MarkdownGuideDoc } from "./markdown-guide";

/** 样式章节：变体优先与工具类边界。 */
export default function StylingGuide() {
	return <MarkdownGuideDoc source={guideSource} />;
}
