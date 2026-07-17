/**
 * MarkdownContent - Markdown 源文本渲染（react-markdown 管线）
 *
 * 与 HtmlContent（hast 管线，渲染后端预渲染的 content_html）互补：
 * 本组件仅在文章内容为原始 Markdown 文本（旧文章降级路径）时使用。
 *
 * 刻意独立成模块并经 ArticleContent 懒加载：react-markdown + remark-gfm +
 * rehype-slug 体积较大，而绝大多数文章走 content_html 路径用不到，不应进入正文主包。
 */
import ReactMarkdown from "react-markdown";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { markdownComponents } from "./components/markdown-components";

export interface MarkdownContentProps {
    /** Markdown 源文本 */
    content: string;
    className?: string;
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
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
