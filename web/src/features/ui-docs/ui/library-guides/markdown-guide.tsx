/** 指南正文沿用文章 Markdown 渲染管线，并把渲染后的标题交给目录适配层。 */
import { MarkdownContent } from "@shared/ui/markdown-preview/MarkdownContent";
import type { Components } from "react-markdown";
import { GuideTocContent } from "../LibraryGuideToc";

export interface MarkdownGuideDocProps {
	/** Markdown 源文本（调用方经 ?raw 导入） */
	source: string;
	/** 透传给 MarkdownContent 根容器的附加类名（文档排版微调） */
	className?: string;
	/** 按需替换代码渲染，行内代码须回退到默认实现。 */
	codeRenderer?: Components["code"];
}

/**
 * MarkdownGuideDoc - 指南正文渲染 + 页内目录上报。
 *
 * @example
 * ```tsx
 * import guideSource from "./content/theming.md?raw";
 * <MarkdownGuideDoc source={guideSource} />
 * ```
 */
export function MarkdownGuideDoc({ source, className, codeRenderer }: MarkdownGuideDocProps) {
	return (
		<GuideTocContent contentKey={source}>
			<MarkdownContent content={source} className={className} codeRenderer={codeRenderer} />
		</GuideTocContent>
	);
}
