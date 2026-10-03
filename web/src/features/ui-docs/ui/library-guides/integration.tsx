import guideSource from "./content/integration.md?raw";
import { MarkdownGuideDoc } from "./markdown-guide";

/** 框架集成章节：Vite 与 TanStack Start 实证，纯 HTML 与更多框架的边界。 */
export default function IntegrationGuide() {
	return <MarkdownGuideDoc source={guideSource} />;
}
