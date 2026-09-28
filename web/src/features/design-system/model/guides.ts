/**
 * 营造法式的完整目录：侧栏导航、指南页标题、上下篇与组件目录共用这一份真相。
 */
export interface CatalogSubItem {
	/** 组件标识 */
	id: string;
	/** 组件名 */
	title: string;
	/** 用法页路由 */
	to: string;
	/** 一句话用途 */
	description: string;
	/** 包公开组件或站点私有套件 */
	category: "library" | "site";
}

export interface CatalogItem {
	/** 章节标识；指南类同时是 /guides/:slug 的 slug */
	id: string;
	/** 章节标题 */
	title: string;
	/** 范围说明 */
	scope: string;
	/** 路由地址 */
	to: string;
	/** 可选二级用法页（组件目录） */
	children?: readonly CatalogSubItem[];
}

export interface CatalogGroup {
	/** 卷别标识 */
	id: string;
	/** 卷别名称 */
	title: string;
	/** 卷内章节 */
	items: readonly CatalogItem[];
}

export const DESIGN_SYSTEM_CATALOG: readonly CatalogGroup[] = [
	{
		id: "getting-started",
		title: "卷一 · 入门",
		items: [
			{
				id: "introduction",
				title: "介绍",
				scope: "@violet/ui 的使用边界与已有能力。",
				to: "/design-system/guides/introduction",
			},
			{
				id: "quick-start",
				title: "快速入门",
				scope: "从安装依赖到运行第一个 Button。",
				to: "/design-system/guides/quick-start",
			},
			{
				id: "integration",
				title: "框架集成",
				scope: "Vite 与 TanStack Start 已验证，其他框架暂未开放。",
				to: "/design-system/guides/integration",
			},
			{
				id: "cli",
				title: "命令行",
				scope: "构建、打包与工作区开发命令。",
				to: "/design-system/guides/cli",
			},
			{
				id: "roadmap",
				title: "版本记录",
				scope: "当前版本的能力变更与发布节奏。",
				to: "/design-system/guides/roadmap",
			},
		],
	},
	{
		id: "principles",
		title: "卷二 · 纲纪准则",
		items: [
			{
				id: "principles",
				title: "设计原则",
				scope: "查表无果时回退的最高判据，与贯穿全站的底线。",
				to: "/design-system/principles",
			},
			{
				id: "decisions",
				title: "快速决策表",
				scope: "不知道该用哪个 token 时，先查这张表。表里没有的，回到基本原则。",
				to: "/design-system/decisions",
			},
		],
	},
	{
		id: "foundations",
		title: "卷三 · 设计法度",
		items: [
			{
				id: "theming",
				title: "主题",
				scope: "CSS 变量、默认色板与方言。",
				to: "/design-system/guides/theming",
			},
			{
				id: "dark-mode",
				title: "深色模式",
				scope: "通过 html.dark 切换语义色。",
				to: "/design-system/guides/dark-mode",
			},
			{
				id: "styling",
				title: "样式",
				scope: "Tailwind v4 与组件变体的职责。",
				to: "/design-system/guides/styling",
			},
			{
				id: "composition",
				title: "组合",
				scope: "原生语义、asChild 与组合式组件。",
				to: "/design-system/guides/composition",
			},
			{
				id: "palette",
				title: "色板生成器",
				scope: "以单一主色为种，推演全域色阶、语义角色与中性基准。",
				to: "/design-system/palette",
			},
			{
				id: "tokens",
				title: "Token 词典",
				scope: "品牌色、功能色、中性色、语义色——全部语义 token 的名称与实时值。",
				to: "/design-system/tokens",
			},
			{
				id: "layout",
				title: "布局规格",
				scope: "间距、圆角、投影与容器的法定刻度。",
				to: "/design-system/layout",
			},
			{
				id: "motion",
				title: "动效章程",
				scope: "运动的时间、幅度与克制的事由。",
				to: "/design-system/motion",
			},
		],
	},
	{
		id: "specimens",
		title: "卷四 · 构件陈列",
		items: [
			{
				id: "specimens",
				title: "组件目录",
				scope: "组件文档的共通要求与按能力取舍，以及本站真实组件示例。",
				to: "/design-system/specimens",
				children: [
					{
						id: "button",
						title: "Button",
						to: "/design-system/specimens/button",
						description: "按钮 · 动作层级与交互状态",
						category: "library",
					},
					{
						id: "badge",
						title: "Badge",
						to: "/design-system/specimens/badge",
						description: "徽章与角标 · 标签、数量与状态提示",
						category: "library",
					},
					{
						id: "checkbox",
						title: "Checkbox",
						to: "/design-system/specimens/checkbox",
						description: "复选框 · 三态选择与微光实体反馈",
						category: "library",
					},
					{
						id: "dialog",
						title: "Dialog",
						to: "/design-system/specimens/dialog",
						description: "弹窗 · 焦点管理与关闭语义",
						category: "library",
					},
					{
						id: "tabs",
						title: "Tabs",
						to: "/design-system/specimens/tabs",
						description: "标签页 · 面板与键盘导航",
						category: "library",
					},
					{
						id: "input",
						title: "Input",
						to: "/design-system/specimens/input",
						description: "输入框 · 受控输入与表单状态",
						category: "library",
					},
					{
						id: "comment-section",
						title: "CommentSection",
						to: "/design-system/specimens/comment-section",
						description: "评论区 · 纯展示评论套件",
						category: "site",
					},
					{
						id: "cartoon-popover",
						title: "CartoonPopover",
						to: "/design-system/specimens/cartoon-popover",
						description: "卡通气泡 · 纯手绘对白与思考浮层",
						category: "site",
					},
				],
			},
		],
	},
	{
		id: "agents",
		title: "卷五 · 智能体",
		items: [
			{
				id: "llms",
				title: "LLMs.txt",
				scope: "供智能体读取的文档索引。",
				to: "/design-system/guides/llms",
			},
			{
				id: "mcp",
				title: "MCP 服务器",
				scope: "组件库文档与站点内容服务的权限边界。",
				to: "/design-system/guides/mcp",
			},
			{
				id: "skills",
				title: "Agent Skills",
				scope: "项目内组件使用与编辑规则的入口。",
				to: "/design-system/guides/skills",
			},
			{
				id: "agents-md",
				title: "AGENTS.md",
				scope: "仓库及包内代理规范如何配合文档。",
				to: "/design-system/guides/agents-md",
			},
		],
	},
] as const;

/** 展平后的全部章节条目。 */
export const CATALOG_ITEMS = DESIGN_SYSTEM_CATALOG.flatMap((group) => group.items);

/** 指南类章节（路由挂在 /design-system/guides/:slug 下的条目）。 */
export const GUIDE_ROUTE_PREFIX = "/design-system/guides/";

export const CATALOG_GUIDES = CATALOG_ITEMS.filter((item) =>
	item.to.startsWith(GUIDE_ROUTE_PREFIX),
);
