/**
 * Markdown 预览组件内联元素映射
 *
 * react-markdown 默认渲染原生 HTML 标签，Tailwind v4 Preflight 会剥掉默认样式。
 * 这里通过 components 自定义关键元素的 className，保证排版美观，
 * 不依赖 @tailwindcss/typography 插件（项目未全局启用 prose）。
 */

import type { Components } from "react-markdown";
import { cn } from "@/shared/lib/utils";
import { CodeBlock } from "./CodeBlock";

export const markdownComponents: Components = {
    h1: ({ children, style, className }) => (
        <h1
            style={style}
            className={cn("mb-5 mt-10 text-3xl font-bold tracking-tight first:mt-0", className)}
        >
            {children}
        </h1>
    ),
    h2: ({ children, style, className }) => (
        <h2
            style={style}
            className={cn(
                "mb-4 mt-10 border-b border-edge-hairline pb-2 text-2xl font-bold tracking-tight first:mt-0",
                className,
            )}
        >
            {children}
        </h2>
    ),
    h3: ({ children, style, className }) => (
        <h3
            style={style}
            className={cn("mb-3 mt-8 text-xl font-semibold tracking-tight first:mt-0", className)}
        >
            {children}
        </h3>
    ),
    h4: ({ children, style, className }) => (
        <h4 style={style} className={cn("mb-3 mt-6 text-lg font-semibold first:mt-0", className)}>
            {children}
        </h4>
    ),
    p: ({ children, style, className }) => (
        <p style={style} className={cn("my-5 leading-8 text-foreground/90", className)}>
            {children}
        </p>
    ),
    ul: ({ children }) => (
        <ul className="my-5 list-disc space-y-2 pl-6 text-foreground/90">{children}</ul>
    ),
    ol: ({ children }) => (
        <ol className="my-5 list-decimal space-y-2 pl-6 text-foreground/90">{children}</ol>
    ),
    li: ({ children }) => <li className="leading-8">{children}</li>,
    blockquote: ({ children }) => (
        <blockquote className="my-6 border-l-4 border-primary/50 bg-muted/40 py-2 pl-5 italic text-foreground/80">
            {children}
        </blockquote>
    ),
    a: ({ children, href }) => (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 transition-opacity hover:opacity-80"
        >
            {children}
        </a>
    ),
    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    del: ({ children }) => <del className="text-muted-foreground line-through">{children}</del>,
    hr: () => <hr className="my-8 border-edge-hairline" />,
    table: ({ children }) => (
        <div className="my-6 overflow-x-auto">
            <table className="w-full border-collapse text-sm">{children}</table>
        </div>
    ),
    thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
    th: ({ children }) => (
        <th className="border border-edge-hairline px-3 py-2 text-left font-semibold">
            {children}
        </th>
    ),
    td: ({ children }) => <td className="border border-edge-hairline px-3 py-2">{children}</td>,
    // 代码：围栏块走 CodeBlock（shiki 高亮 + 语言标签 + 复制），行内走纯样式
    code: ({ className, children }) => <CodeBlock className={className}>{children}</CodeBlock>,
    // pre 由 CodeBlock 内部接管，此处直接透传避免双重包裹
    pre: ({ children }) => <>{children}</>,
    img: ({ src, alt }) => (
        <img
            src={typeof src === "string" ? src : undefined}
            alt={alt ?? ""}
            className="my-6 max-w-full rounded-lg"
            loading="lazy"
        />
    ),
};
