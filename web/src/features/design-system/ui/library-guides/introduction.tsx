import guideSource from "./content/introduction.md?raw";
import { MarkdownGuideDoc } from "./markdown-guide";

/** 介绍章节：组件库定位、核心特性与常见问题。 */
export default function IntroductionGuide() {
	return <MarkdownGuideDoc source={guideSource} />;
}
