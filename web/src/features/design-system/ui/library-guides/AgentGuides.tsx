import type { ReactNode } from "react";
import packageAgentRules from "../../../../../packages/ui/AGENTS.md?raw";
import { ComponentDemo } from "../ComponentDemo";
import { ButtonBasicDemo } from "../examples/button/basic";
import buttonBasicSource from "../examples/button/basic.tsx?raw";
import { GuideCode, GuideLink, GuideSection } from "./GuideParts";

export const AGENT_GUIDES: Record<string, ReactNode> = {
	llms: (
		<>
			<GuideSection title="机器可读索引">
				<p>
					<a
						className="font-medium text-primary underline underline-offset-4"
						href="/llms.txt"
					>
						打开 /llms.txt
					</a>{" "}
					可获取可直接读取的 Markdown 文档清单，包含入门、设计规范和已成文组件页；无需执行
					JavaScript。
				</p>
				<p>
					llms.txt 是文档发现入口，不包含组件源码或实时 props 表。使用组件前查看{" "}
					<GuideLink to="/design-system/specimens">组件用法页</GuideLink>，再核对{" "}
					<code>web/packages/ui/src/index.ts</code> 的真实导出。
				</p>
			</GuideSection>
		</>
	),
	mcp: (
		<>
			<GuideSection title="当前服务边界">
				<p>
					站点已有的 violet-reader/posts/comments 等 MCP
					服务处理博客内容与读者反馈；它们不提供 <code>@violet/ui</code>{" "}
					的组件文档、源码或主题查询。当前没有可安装的「营造法式 MCP server」，不应将博客
					MCP 地址作为组件工具接入。
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
		</>
	),
	skills: (
		<>
			<GuideSection title="随仓库分发的技能">
				<p>
					项目内 <code>.agents/skills/violet-ui/SKILL.md</code>{" "}
					规定包导出、样式导入、示例同源和浏览器核对顺序；
					<code>frontend-conventions</code> 管文件落位，
					<code>tailwind-canonical-classes</code> 管 Tailwind
					类名。它们随仓库提供，无需外部安装脚本。
				</p>
				<GuideCode
					language="bash"
					code="cd web\npnpm dev\n# 访问 /design-system/specimens 查看真实组件示例"
				/>
				<p>在本仓库内让编码智能体按规则调用这几个 skill；仓库外暂不提供可安装的技能包。</p>
			</GuideSection>
		</>
	),
	preview: (
		<>
			<GuideSection title="预览真实组件">
				<p>
					下面是实际运行的 <code>@violet/ui</code>{" "}
					Button：点击观察计数，展开源码查看同一个示例文件。打开{" "}
					<GuideLink to="/design-system/specimens">组件目录</GuideLink>{" "}
					可访问更多交互预览。
				</p>
				<ComponentDemo code={buttonBasicSource}>
					<ButtonBasicDemo />
				</ComponentDemo>
			</GuideSection>
			<GuideSection title="验收场景">
				<p>
					切换网站明暗主题核对语义色，键盘 Tab
					聚焦操作按钮，并在移动端检查侧栏和组件布局。文档预览是当前站点版本的真实运行结果，不等于库已作为
					npm 包发布。
				</p>
			</GuideSection>
		</>
	),
	"agents-md": (
		<>
			<GuideSection title="包内规则">
				<p>
					包中的 <code>web/packages/ui/AGENTS.md</code>{" "}
					约束导出、样式归属和示例同步；根目录 <code>AGENTS.md</code>{" "}
					继续约束整仓架构、提交和检查。下面展示包内文件原文，更新文件即可同步本页。
				</p>
				<GuideCode
					language="markdown"
					title="web/packages/ui/AGENTS.md"
					code={packageAgentRules}
				/>
			</GuideSection>
		</>
	),
};
