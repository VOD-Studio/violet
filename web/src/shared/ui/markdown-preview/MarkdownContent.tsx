/**
 * MarkdownContent - Markdown 源文本渲染（react-markdown 管线）
 *
 * 与 HtmlContent（hast 管线，渲染后端预渲染的 content_html）互补：
 * 本组件仅在文章内容为原始 Markdown 文本（旧文章降级路径）时使用。
 *
 * 刻意独立成模块并经 ArticleContent 懒加载：react-markdown + remark-gfm
 * 体积较大，而绝大多数文章走 content_html 路径用不到，不应进入正文主包。
 * remark-math 解析 $..$/$$..$$，由 markdownComponents 数学分支渲染（与 HTML 路径共用 KaTeX 组件）。
 *
 * 标题 id 用自写 rehypeSlugHeadings plugin（项目统一 slugify 规则），
 * 与 HtmlContent.ensureHeadingIds / extractToc 一致，保证 TOC 锚点可跳。
 */

import { Slugger } from "@shared/lib/slug";
import type { Element, Nodes, Root } from "hast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { markdownComponents } from "./components/markdown-components";

/** 提取 hast 节点的纯文本（递归拼接子节点的 text） */
function hastText(node: Nodes): string {
	if (node.type === "text") return node.value;
	if (node.type === "element") return node.children.map(hastText).join("");
	return "";
}

/**
 * rehypeSlugHeadings - 给 h1-h6 补 id 的 rehype plugin。
 *
 * 替代 rehype-slug（写死 github-slugger 规则），用项目统一的
 * Slugger 保证与 HtmlContent/extractToc 产出的 id 一致。
 * 每次 transform 新建 Slugger 实例（一篇文章内去重，跨文章不累积）。
 */
function rehypeSlugHeadings() {
	const slugger = new Slugger();
	const visit = (node: Nodes) => {
		if (node.type === "element") {
			const el = node as Element;
			if (
				el.tagName.length === 2 &&
				el.tagName[0] === "h" &&
				el.tagName[1] >= "1" &&
				el.tagName[1] <= "6" &&
				!el.properties?.id
			) {
				const text = el.children.map(hastText).join("").trim();
				if (text) {
					el.properties = { ...(el.properties ?? {}), id: slugger.slug(text) };
				}
			}
		}
		if ("children" in node) {
			for (const c of node.children) visit(c);
		}
	};
	return (tree: Root) => {
		visit(tree);
	};
}

export interface MarkdownContentProps {
	/** Markdown 源文本 */
	content: string;
	className?: string;
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
	return (
		<div className={className}>
			<ReactMarkdown
				remarkPlugins={[remarkGfm, remarkMath]}
				rehypePlugins={[rehypeSlugHeadings]}
				components={markdownComponents}
			>
				{content}
			</ReactMarkdown>
		</div>
	);
}
