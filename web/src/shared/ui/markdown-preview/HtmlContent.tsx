/**
 * HtmlContent - 安全渲染 HTML 字符串（content_html）
 *
 * 直接走 hast 管道：hast-util-raw 把 HTML 解析为 hast → hast-util-sanitize 白名单清洗 →
 * hast-util-to-jsx-runtime 渲染为 React（复用 markdownComponents，含 shiki 代码块）。
 *
 * 刻意不经过 react-markdown / remark-parse：后者会把整段 HTML 当 markdown 重新解析，
 * 代码块内的空行会被 CommonMark 当作 HTML 块边界截断，导致一个代码块被拆成多段、
 * 混入段落，格式全乱。HTML 内容必须按 HTML 解析，这是本组件存在的意义。
 */

import type { Element, Nodes } from "hast";
import { raw } from "hast-util-raw";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { Slugger } from "@/shared/lib/slug";
import type { ArticleContentContext } from "../article-embeds/types";
import { createMarkdownComponents } from "./components/markdown-components";
import { sanitizeContent } from "./sanitize-content";

// raw 节点（{ type: "raw"; value: html }）由 mdast-util-to-hast 全局扩展进 hast 的
// RootContentMap，hast-util-raw 据此把 HTML 字符串解析为正式 hast 节点。

/** HTML 字符串 → hast：包成 raw 节点交给 hast-util-raw 解析，纯 HTML 不经过 markdown */
function htmlToHast(html: string): Nodes {
	return raw({ type: "root", children: [{ type: "raw", value: html }] });
}

/** 递归提取 hast 节点的纯文本（用于给无 id 的 heading 生成 slug） */
function hastText(node: Nodes): string {
	if (node.type === "text") return node.value;
	if (node.type === "element") {
		return node.children.map((c) => hastText(c)).join("");
	}
	return "";
}

/**
 * 为 sanitize 后无 id 的 h2/h3/h4 补上 slug id，使 DOM 锚点与目录
 * （extractToc 用同一 Slugger 规则生成）一致，点击目录才能滚动到位。
 * 去重由 Slugger 内置（相同文本追加 -1/-2…），与 extractToc 行为一致。
 */
function ensureHeadingIds(tree: Nodes): Nodes {
	const slugger = new Slugger();
	const visit = (node: Nodes) => {
		// root 与 element 都需遍历 children（root 本身不是 element）
		if (node.type === "element") {
			const el = node as Element;
			if (
				(el.tagName === "h2" || el.tagName === "h3" || el.tagName === "h4") &&
				!el.properties?.id
			) {
				const text = hastText(el).trim();
				if (text) {
					const id = slugger.slug(text);
					el.properties = { ...(el.properties ?? {}), id };
				}
			}
		}
		if ("children" in node) {
			for (const c of node.children) visit(c);
		}
	};
	visit(tree);
	return tree;
}

export interface HtmlContentProps {
	/** HTML 字符串 */
	html: string;
	/** 外层 className（通常含 prose 排版类） */
	className?: string;
	/** 文章级人物等可选上下文，仅传给语义化内容节点。 */
	context?: ArticleContentContext;
}

export function HtmlContent({ html, className, context }: HtmlContentProps) {
	const cleaned = ensureHeadingIds(sanitizeContent(htmlToHast(html)));
	return (
		<div className={className}>
			{toJsxRuntime(cleaned, {
				Fragment,
				jsx,
				jsxs,
				components: createMarkdownComponents(context),
			})}
		</div>
	);
}
