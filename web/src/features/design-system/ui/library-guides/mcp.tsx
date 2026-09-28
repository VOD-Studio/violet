import { GuideSection } from "./GuideParts";

/** MCP 服务器章节：博客 MCP 与组件文档服务的边界。 */
export default function McpGuide() {
	return (
		<GuideSection title="当前服务边界">
			<p>
				站点已有的 violet-reader/posts/comments 等 MCP
				服务处理博客内容与读者反馈；它们不提供 <code>@violet/ui</code>{" "}
				的组件文档、源码或主题查询。当前没有可安装的「营造法式 MCP server」，不应将博客 MCP
				地址作为组件工具接入。
			</p>
			<p>
				智能体读取{" "}
				<a
					className="font-medium text-primary underline underline-offset-4"
					href="/llms.txt"
				>
					llms.txt
				</a>{" "}
				和仓库源码即可查到真实文档；MCP 服务清单及鉴权要求以仓库的{" "}
				<code>docs/guides/mcp-servers.md</code> 为准。
			</p>
		</GuideSection>
	);
}
