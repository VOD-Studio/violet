/**
 * FencedCodeBlock - 围栏代码块（shiki 高亮 + 语言标签 + 复制）
 *
 * 供 markdown-components 懒加载：只有文章正文出现围栏代码块时，才拉取本模块
 * 及其依赖（useShikiHighlight → shiki core 单例），不进入文章正文主 chunk。
 * 实现 已上提公共 CodeCard（code-preview 模块），此处保留懒加载入口薄壳。
 *
 * 行内代码由 markdown-components 内联处理（纯样式，无高亮），不走本组件。
 */
import { CodeCard } from "@/shared/ui/code-preview/components/CodeCard";

/**
 * FencedCodeBlock - 围栏代码块：shiki 高亮 + 语言标签 + 复制按钮
 */
export function FencedCodeBlock({ code, language }: { code: string; language: string }) {
	return <CodeCard code={code} language={language} className="my-6" />;
}
