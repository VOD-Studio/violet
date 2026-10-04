import guideSource from "./content/quick-start.md?raw";
import { MarkdownGuideDoc } from "./markdown-guide";

/** 快速入门章节：环境要求、安装、导入样式、第一个组件与下一步。 */
export default function QuickStartGuide() {
	return <MarkdownGuideDoc source={guideSource} />;
}
