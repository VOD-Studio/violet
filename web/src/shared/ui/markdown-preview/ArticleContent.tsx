/**
 * ArticleContent - 文章正文渲染（自动识别 Markdown / HTML）
 *
 * 编辑器内容格式可能有两种来源：
 * - 新文章（HTML 序列化）：content_md 含 HTML（保留颜色/对齐等 inline 样式）
 * - 旧文章（Markdown 序列化）：content_md 含原始 Markdown 文本
 *
 * 自动检测：内容含 HTML 标签（<p>、<h2>、<div> 等）→ HtmlContent 安全渲染；
 * 否则 → react-markdown + shiki 代码块渲染。两条路径共用 markdownComponents。
 */
import { memo } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { markdownComponents } from "./components/markdown-components";
import { HtmlContent } from "./HtmlContent";

export interface ArticleContentProps {
    /** 文章内容（Markdown 或 HTML 字符串） */
    content: string;
    className?: string;
}

/** 检测内容是否为 HTML（含开闭标签，排除纯文本里的 < > 比较） */
function isHTML(content: string): boolean {
    // 需同时含 <tag> 开标签且非行内代码块内的片段
    return /<(p|div|h[1-6]|ul|ol|li|blockquote|pre|code|table|img|span|figure|section|article)\b[\s>]/i.test(
        content,
    );
}

function ArticleContent({ content, className }: ArticleContentProps) {
    if (isHTML(content)) {
        return <HtmlContent html={content} className={className} />;
    }
    return (
        <div className={className}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSlug]}
                components={markdownComponents}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}

/** 正文渲染开销较大，props 不变时跳过重渲染，避免目录高亮/滚动状态变化触发整篇文章重排。 */
export default memo(ArticleContent);
