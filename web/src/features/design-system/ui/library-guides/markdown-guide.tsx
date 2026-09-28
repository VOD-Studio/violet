/**
 * MarkdownGuideDoc - 指南正文 Markdown 薄壳
 *
 * 渲染一律复用文章正文管线 @shared/ui/markdown-preview 的 MarkdownContent
 * （GFM + 数学 + 富代码/嵌入组件；围栏代码块经 rich-code-renderer 懒加载
 * CodeCard，标题锚点走管线内 ProseHeading 与项目统一 Slugger）。
 * 本组件不改 shared 管线，只负责文档场景两件事：
 * 1. 渲染完成后从容器 DOM 提取 h2/h3，经 GuideTocContext 上报页内目录
 *    （上下文缺席（页面外挂载）时静默跳过，不报错）；
 * 2. 透传 className 供调用方做文档排版微调。
 */
import { MarkdownContent } from "@shared/ui/markdown-preview/MarkdownContent";
import { useLayoutEffect, useRef } from "react";
import { type GuideTocItem, useGuideTocRegistrar } from "../LibraryGuideToc";

/** 从渲染后的正文容器提取 h2/h3 目录条目（id 由管线内 Slugger 生成，直接采信） */
function extractGuideToc(el: HTMLElement): GuideTocItem[] {
	return Array.from(el.querySelectorAll<HTMLElement>("h2[id], h3[id]"))
		.map((heading) => ({
			level: Number(heading.tagName.slice(1)) as 2 | 3,
			text: (heading.textContent ?? "").trim(),
			id: heading.id,
		}))
		.filter((item) => item.id !== "" && item.text !== "");
}

export interface MarkdownGuideDocProps {
	/** Markdown 源文本（调用方经 ?raw 导入） */
	source: string;
	/** 透传给 MarkdownContent 根容器的附加类名（文档排版微调） */
	className?: string;
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
export function MarkdownGuideDoc({ source, className }: MarkdownGuideDocProps) {
	const registerToc = useGuideTocRegistrar();
	const bodyRef = useRef<HTMLDivElement>(null);
	// biome-ignore lint/correctness/useExhaustiveDependencies: source 变更后 DOM 已重渲染，需重新提取标题
	useLayoutEffect(() => {
		const el = bodyRef.current;
		if (!el) return;
		const items = extractGuideToc(el);
		registerToc(items.length > 0 ? { items, bodyRef } : null);
		return () => registerToc(null);
	}, [source, registerToc]);

	return (
		<div ref={bodyRef}>
			<MarkdownContent content={source} className={className} />
		</div>
	);
}
