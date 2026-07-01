/**
 * HtmlContent - 安全渲染 HTML 字符串（无 dangerouslySetInnerHTML）
 *
 * 用 react-markdown + rehype-raw（解析 HTML 为 HAST）+ rehype-sanitize（白名单清洗防 XSS），
 * 最终渲染为 React 元素。复用 markdownComponents（含 shiki 代码块），与 MD 路径渲染一致。
 *
 * 用途：渲染文章的 content_html（编辑器/后端预渲染的 HTML）。
 */
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import { markdownComponents } from "./components/markdown-components";

/**
 * sanitize schema：在默认白名单基础上放宽，允许 class/style（shiki 高亮 + 排版所需）、
 * 以及常见文章元素（details/summary 等）。保持 script/iframe/event handler 等危险项被剥离。
 */
const schema = {
    ...defaultSchema,
    attributes: {
        ...defaultSchema.attributes,
        "*": [...(defaultSchema.attributes?.["*"] ?? []), "className", "class", "style", "id"],
    },
    // 允许 article 正文中常见的额外标签
    tagNames: [
        ...(defaultSchema.tagNames ?? []),
        "img",
        "figure",
        "figcaption",
        "details",
        "summary",
        "mark",
        "kbd",
        "abbr",
    ],
};

export interface HtmlContentProps {
    /** HTML 字符串 */
    html: string;
    /** 外层 className（通常含 prose 排版类） */
    className?: string;
}

export function HtmlContent({ html, className }: HtmlContentProps) {
    return (
        <div className={className}>
            <ReactMarkdown
                remarkPlugins={[]}
                // 顺序：raw 先把 HTML 解析进 AST，sanitize 再清洗，slug 补标题 id
                rehypePlugins={[rehypeRaw, [rehypeSanitize, schema], rehypeSlug]}
                components={markdownComponents}
            >
                {html}
            </ReactMarkdown>
        </div>
    );
}
