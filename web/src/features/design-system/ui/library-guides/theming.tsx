import guideSource from "./content/theming.md?raw";
import { MarkdownGuideDoc } from "./markdown-guide";

/** 主题章节：从包样式导入到宿主的明暗切换与作用域定制。 */
export default function ThemingGuide() {
	return <MarkdownGuideDoc source={guideSource} />;
}
