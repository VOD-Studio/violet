import componentManifest from "../../../../packages/ui/component-manifest.json";

export interface CatalogSubItem {
	id: string;
	title: string;
	to: string;
	description: string;
}

export interface CatalogItem {
	id: string;
	title: string;
	scope: string;
	to: string;
	children?: readonly CatalogSubItem[];
}

export interface CatalogGroup {
	id: string;
	title: string;
	items: readonly CatalogItem[];
}

export const UI_DOCS_CATALOG: readonly CatalogGroup[] = [
	{
		id: "getting-started",
		title: "入门",
		items: [
			{
				id: "introduction",
				title: "介绍",
				scope: "@violet/ui 的使用边界与已有能力。",
				to: "/ui/guides/introduction",
			},
			{
				id: "quick-start",
				title: "快速入门",
				scope: "安装组件包并运行第一个 Button。",
				to: "/ui/guides/quick-start",
			},
			{
				id: "integration",
				title: "框架集成",
				scope: "Vite、SSR 与普通 CSS 的接入边界。",
				to: "/ui/guides/integration",
			},
		],
	},
	{
		id: "styling",
		title: "主题与样式",
		items: [
			{
				id: "theming",
				title: "主题",
				scope: "导入、切换与扩展语义变量和色板。",
				to: "/ui/guides/theming",
			},
			{
				id: "dark-mode",
				title: "深色模式",
				scope: "主题偏好、首屏输出与明暗切换。",
				to: "/ui/guides/dark-mode",
			},
			{
				id: "styling",
				title: "样式",
				scope: "组件 CSS、Tailwind v4 与局部覆盖。",
				to: "/ui/guides/styling",
			},
			{
				id: "animation",
				title: "动画",
				scope: "状态反馈与减弱动态。",
				to: "/ui/guides/animation",
			},
			{
				id: "composition",
				title: "组合",
				scope: "原生语义、asChild 与组合式组件。",
				to: "/ui/guides/composition",
			},
		],
	},
	{
		id: "components",
		title: "组件",
		items: [
			{
				id: "components",
				title: "组件目录",
				scope: "真实组件用法、可操作示例与成熟度。",
				to: "/ui/components",
				children: [
					{
						id: "button",
						title: "Button",
						to: "/ui/components/button",
						description: "按钮 · 动作层级与交互状态",
					},
					{
						id: "badge",
						title: "Badge",
						to: "/ui/components/badge",
						description: "徽章与角标 · 标签、数量与状态提示",
					},
					{
						id: "checkbox",
						title: "Checkbox",
						to: "/ui/components/checkbox",
						description: "复选框 · 三态选择与原生表单",
					},
					{
						id: "dialog",
						title: "Dialog",
						to: "/ui/components/dialog",
						description: "弹窗 · 焦点管理与关闭语义",
					},
					{
						id: "tabs",
						title: "Tabs",
						to: "/ui/components/tabs",
						description: "标签页 · 面板与键盘导航",
					},
					{
						id: "input",
						title: "Input",
						to: "/ui/components/input",
						description: "输入框 · 原生输入与表单状态",
					},
					{
						id: "text-field",
						title: "TextField",
						to: "/ui/components/text-field",
						description: "文本字段 · 名称、说明与校验状态",
					},
				],
			},
		],
	},
	{
		id: "development",
		title: "开发",
		items: [
			{
				id: "architecture",
				title: "组件库架构",
				scope: "组件单元、样式依赖与分发边界。",
				to: "/ui/guides/architecture",
			},
			{
				id: "component-design",
				title: "组件设计方法",
				scope: "从消费场景到行为验证与 tarball 交付。",
				to: "/ui/guides/component-design",
			},
			{
				id: "cli",
				title: "命令行",
				scope: "构建、打包与工作区开发命令。",
				to: "/ui/guides/cli",
			},
			{
				id: "roadmap",
				title: "重建进度",
				scope: "foundation 与 legacy 的迁移范围。",
				to: "/ui/guides/roadmap",
			},
		],
	},
	{
		id: "agents",
		title: "智能体",
		items: [
			{
				id: "llms",
				title: "LLMs.txt",
				scope: "供智能体读取的文档索引。",
				to: "/ui/guides/llms",
			},
			{
				id: "mcp",
				title: "MCP 服务器",
				scope: "组件文档与站点内容服务的边界。",
				to: "/ui/guides/mcp",
			},
			{
				id: "skills",
				title: "Agent Skills",
				scope: "组件使用与编辑规则的入口。",
				to: "/ui/guides/skills",
			},
			{
				id: "agents-md",
				title: "AGENTS.md",
				scope: "仓库规范与包内规范。",
				to: "/ui/guides/agents-md",
			},
		],
	},
];

export const CATALOG_ITEMS = UI_DOCS_CATALOG.flatMap((group) => group.items);
export const GUIDE_ROUTE_PREFIX = "/ui/guides/";
export const CATALOG_GUIDES = CATALOG_ITEMS.filter((item) =>
	item.to.startsWith(GUIDE_ROUTE_PREFIX),
);

export const COMPONENT_DOCS =
	CATALOG_ITEMS.find((item) => item.id === "components")?.children ?? [];

export const FOUNDATION_COMPONENTS = componentManifest.components.filter(
	(component) => component.status === "foundation",
);
export const LEGACY_COMPONENTS = componentManifest.components.filter(
	(component) => component.status === "legacy",
);

export function getComponentStatus(name: string): string | undefined {
	return componentManifest.components.find((component) => component.name === name)?.status;
}
