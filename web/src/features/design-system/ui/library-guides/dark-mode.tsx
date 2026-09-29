import guideSource from "./content/dark-mode.md?raw";
import { MarkdownGuideDoc } from "./markdown-guide";

/** 深色模式章节：CSS 驱动的明暗切换与宿主职责。 */
export default function DarkModeGuide() {
	return <MarkdownGuideDoc source={guideSource} />;
}
