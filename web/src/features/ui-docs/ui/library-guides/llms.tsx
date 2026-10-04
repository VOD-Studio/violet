import guideSource from "./content/llms.md?raw";
import { MarkdownGuideDoc } from "./markdown-guide";

/** LLMs.txt 章节：机器可读的文档发现入口与智能体接入。 */
export default function LlmsGuide() {
	return <MarkdownGuideDoc source={guideSource} />;
}
