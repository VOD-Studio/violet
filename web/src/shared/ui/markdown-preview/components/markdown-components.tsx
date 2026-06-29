/**
 * Markdown 预览组件内联元素映射
 *
 * react-markdown 默认渲染原生 HTML 标签，Tailwind v4 Preflight 会剥掉默认样式。
 * 这里通过 components 自定义关键元素的 className，保证排版美观，
 * 不依赖 @tailwindcss/typography 插件（项目未全局启用 prose）。
 */

import type { Components } from "react-markdown";

export const markdownComponents: Components = {
    h1: ({ children }) => <h1 className="mb-4 mt-6 text-2xl font-bold first:mt-0">{children}</h1>,
    h2: ({ children }) => (
        <h2 className="mb-3 mt-5 border-b pb-1 text-xl font-bold first:mt-0">{children}</h2>
    ),
    h3: ({ children }) => (
        <h3 className="mb-2 mt-4 text-lg font-semibold first:mt-0">{children}</h3>
    ),
    h4: ({ children }) => (
        <h4 className="mb-2 mt-3 text-base font-semibold first:mt-0">{children}</h4>
    ),
    p: ({ children }) => <p className="my-3 leading-7">{children}</p>,
    ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-6">{children}</ul>,
    ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-6">{children}</ol>,
    li: ({ children }) => <li className="leading-7">{children}</li>,
    blockquote: ({ children }) => (
        <blockquote className="my-3 border-l-4 border-primary/40 bg-muted/40 py-1 pl-4 italic">
            {children}
        </blockquote>
    ),
    a: ({ children, href }) => (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:opacity-80"
        >
            {children}
        </a>
    ),
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    del: ({ children }) => <del className="text-muted-foreground line-through">{children}</del>,
    hr: () => <hr className="my-6 border-border" />,
    table: ({ children }) => (
        <div className="my-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">{children}</table>
        </div>
    ),
    thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
    th: ({ children }) => (
        <th className="border px-3 py-1.5 text-left font-semibold">{children}</th>
    ),
    td: ({ children }) => <td className="border px-3 py-1.5">{children}</td>,
    // 内联代码
    code: ({ className, children, ...props }) => {
        const isBlock = className?.includes("language-");
        if (isBlock) {
            return (
                <code className={`${className ?? ""} block`} {...props}>
                    {children}
                </code>
            );
        }
        return (
            <code
                className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-primary"
                {...props}
            >
                {children}
            </code>
        );
    },
    pre: ({ children }) => (
        <pre className="my-4 overflow-x-auto rounded-lg bg-[#24292e] p-4 text-sm text-white/90 [&_code]:!bg-transparent [&_code]:!p-0 [&_code]:!text-inherit">
            {children}
        </pre>
    ),
    img: ({ src, alt }) => (
        <img
            src={typeof src === "string" ? src : undefined}
            alt={alt ?? ""}
            className="my-4 max-w-full rounded-lg"
            loading="lazy"
        />
    ),
};
