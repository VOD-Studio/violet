import type { ComponentType } from "react";
import type { DiagramBlockProps } from "./DiagramBlock";

export type { DiagramBlockProps } from "./DiagramBlock";

/**
 * 图块格式对应的阅读端加载与净化契约。
 *
 * @remarks load 只描述加载入口，不预先请求模块；视口门控与失败重试由消费方负责。
 */
export interface DiagramRenderer {
	/** 稳定的模块工厂；失败重试时必须可以再次调用，而不是返回已拒绝的 lazy 组件。 */
	load: () => Promise<{ default: ComponentType<DiagramBlockProps> }>;
	/** 净化管线保留的 hast 驼峰属性名。 */
	sanitizeAttrs: string[];
}

/** 阅读端格式注册表；登记新格式不会立即加载其渲染依赖。 */
export const diagramRenderers: Record<string, DiagramRenderer> = {
	mermaid: {
		load: () => import("./DiagramBlock").then((module) => ({ default: module.DiagramBlock })),
		sanitizeAttrs: ["dataFormat", "dataSource"],
	},
};
