import guideSource from "./content/mcp.md?raw";
import { MarkdownGuideDoc } from "./markdown-guide";

/** MCP 服务器章节：博客 MCP 与组件文档服务的边界。 */
export default function McpGuide() {
	return <MarkdownGuideDoc source={guideSource} />;
}
