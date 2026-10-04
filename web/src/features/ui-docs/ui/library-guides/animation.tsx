import guideSource from "./content/animation.md?raw";
import { MarkdownGuideDoc } from "./markdown-guide";

/** 动画章节：组件动效的工具、编排与无障碍底线。 */
export default function AnimationGuide() {
	return <MarkdownGuideDoc source={guideSource} />;
}
