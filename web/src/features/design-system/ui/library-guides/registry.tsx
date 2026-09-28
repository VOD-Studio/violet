import { lazy } from "react";

/**
 * 指南内容注册表：左侧目录决定路由，右侧正文按章节懒加载。
 * 新增章节时在此登记一行，目录与内容即可接上。
 */
export const GUIDE_CONTENT = {
	introduction: lazy(() => import("./introduction")),
	"quick-start": lazy(() => import("./quick-start")),
	integration: lazy(() => import("./integration")),
	cli: lazy(() => import("./cli")),
	roadmap: lazy(() => import("./roadmap")),
	theming: lazy(() => import("./theming")),
	"dark-mode": lazy(() => import("./dark-mode")),
	styling: lazy(() => import("./styling")),
	composition: lazy(() => import("./composition")),
	llms: lazy(() => import("./llms")),
	mcp: lazy(() => import("./mcp")),
	skills: lazy(() => import("./skills")),
	"agents-md": lazy(() => import("./agents-md")),
} as const;

export type GuideSlug = keyof typeof GUIDE_CONTENT;
