/**
 * renderers - 图块阅读端渲染器注册表
 *
 * 收敛阅读端分发：`format → 渲染器` 映射。markdown-components 的 div 分支识别
 * data-type="diagram-block" 后，按 data-format 查本表拿 ReaderComponent 懒加载渲染。
 * 新增图表格式（plantuml / graphviz 等）在此纯增量登记，不动分发代码（PRD 决策）。
 *
 * mermaid 依赖仅经 DiagramBlock 的 React.lazy 链路加载——不含图块的文章页不触发
 * 该 lazy import，network 面板无 mermaid chunk 请求。
 */
import { type ComponentType, type LazyExoticComponent, lazy } from "react";
import type { DiagramBlockProps } from "./DiagramBlock";

export type { DiagramBlockProps } from "./DiagramBlock";

/** 阅读端渲染器契约 */
export interface DiagramRenderer {
    /**
     * 渲染组件（React.lazy）：props { format, source } → 持 ref 容器 → SVG。
     * lazy 保证对应渲染依赖（mermaid 等）仅在含图块文章页加载。
     */
    ReaderComponent: LazyExoticComponent<ComponentType<DiagramBlockProps>>;
    /**
     * 该格式在 hast sanitize schema 中需要放行的 data-* 属性（hast camelCase 名）。
     * 当前 HtmlContent 的 div 白名单已静态放行 dataFormat/dataSource（所有图块共用），
     * 此字段登记各格式实际依赖，为未来按格式动态装配 schema 留接口。
     */
    sanitizeAttrs: string[];
}

/**
 * format → 渲染器 注册表。
 *
 * 首期只 mermaid 一项；新增格式在此追加一行即可，markdown-components 分发逻辑不变。
 */
export const diagramRenderers: Record<string, DiagramRenderer> = {
    mermaid: {
        ReaderComponent: lazy(() =>
            import("./DiagramBlock").then((m) => ({ default: m.DiagramBlock })),
        ),
        sanitizeAttrs: ["dataFormat", "dataSource"],
    },
};
