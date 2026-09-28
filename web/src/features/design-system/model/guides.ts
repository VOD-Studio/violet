export interface LibraryGuide {
	slug: string;
	title: string;
	scope: string;
}

export interface LibraryGuideGroup {
	id: string;
	title: string;
	items: readonly LibraryGuide[];
}

/** 文档导航和指南标题共用同一份目录。 */
export const LIBRARY_GUIDE_GROUPS: readonly LibraryGuideGroup[] = [
	{
		id: "getting-started",
		title: "组件库 · 概述",
		items: [
			{ slug: "introduction", title: "介绍", scope: "@violet/ui 的使用边界与已有能力。" },
			{ slug: "quick-start", title: "快速入门", scope: "从安装依赖到运行第一个 Button。" },
			{
				slug: "integration",
				title: "框架集成",
				scope: "在现有 React 应用中引入组件与主题。",
			},
			{ slug: "cli", title: "命令行", scope: "实际可用的 pnpm 工作区命令。" },
			{ slug: "examples", title: "组件案例", scope: "可操作的组件示例与真实代码。" },
			{ slug: "roadmap", title: "路线图", scope: "已交付能力与尚未开放的能力。" },
			{ slug: "figma", title: "Figma", scope: "设计文件的现状与可复用的颜色资产。" },
			{ slug: "handbook", title: "手册", scope: "按任务定位设计规范和组件文档。" },
		],
	},
	{
		id: "library-foundations",
		title: "组件库 · 基础",
		items: [
			{ slug: "colors", title: "颜色", scope: "语义色与品牌色如何选择。" },
			{ slug: "theming", title: "主题", scope: "CSS 变量、默认色板与方言。" },
			{ slug: "dark-mode", title: "深色模式", scope: "通过 html.dark 切换语义色。" },
			{ slug: "styling", title: "样式", scope: "Tailwind v4 与组件变体的职责。" },
			{ slug: "animation", title: "动画", scope: "动效章程、组件状态与减少动态效果。" },
			{ slug: "composition", title: "组合", scope: "原生语义、asChild 与组合式组件。" },
			{
				slug: "agentic-ui",
				title: "代理用户界面",
				scope: "代理操作界面的加载、状态和人工确认。",
			},
		],
	},
	{
		id: "library-agents",
		title: "组件库 · 智能体",
		items: [
			{ slug: "llms", title: "LLMs.txt", scope: "供智能体读取的文档索引。" },
			{ slug: "mcp", title: "MCP 服务器", scope: "组件库文档与站点内容服务的权限边界。" },
			{ slug: "skills", title: "Agent Skills", scope: "项目内组件使用与编辑规则的入口。" },
			{ slug: "preview", title: "预览", scope: "在真实页面上核对明暗主题和交互。" },
			{ slug: "agents-md", title: "AGENTS.md", scope: "仓库及包内代理规范如何配合文档。" },
		],
	},
] as const;

export const LIBRARY_GUIDES = LIBRARY_GUIDE_GROUPS.flatMap((group) => group.items);
