import { lazy, memo, Suspense } from "react";
import type { ArticleContentContext } from "../article-embeds/types";
import { HtmlContent } from "./HtmlContent";

/** react-markdown 管线懒加载，避免其依赖进入正文主 chunk */
const MarkdownContent = lazy(() =>
	import("./MarkdownContent").then((m) => ({ default: m.MarkdownContent })),
);

export interface ArticleContentProps {
	/** 已知来源须显式指定；auto 仅兼容未标明格式的旧内容。 */
	contentType?: "markdown" | "html" | "auto";
	/** 文章内容（Markdown 或 HTML 字符串） */
	content: string;
	className?: string;
	/** 文章富内容节点可读取的当前页面上下文。 */
	context?: ArticleContentContext;
}

/** 仅为未知旧来源保留 HTML 标签启发式判断。 */
function isHTML(content: string): boolean {
	return /<(p|div|h[1-6]|ul|ol|li|blockquote|pre|code|table|img|span|figure|section|article)\b[\s>]/i.test(
		content,
	);
}

function ArticleContent({
	content,
	contentType = "auto",
	className,
	context,
}: ArticleContentProps) {
	if (contentType === "html" || (contentType === "auto" && isHTML(content))) {
		return <HtmlContent html={content} className={className} context={context} />;
	}
	return (
		<Suspense fallback={<div className={className} />}>
			<MarkdownContent content={content} className={className} context={context} />
		</Suspense>
	);
}

/** 正文渲染开销较大，props 不变时跳过重渲染，避免目录高亮/滚动状态变化触发整篇文章重排。 */
export default memo(ArticleContent);
