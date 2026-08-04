/**
 * Markdown 预览组件内联元素映射
 *
 * react-markdown 默认渲染原生 HTML 标签，Tailwind v4 Preflight 会剥掉默认样式。
 * 这里通过 components 自定义关键元素的 className，保证排版美观，
 * 不依赖 @tailwindcss/typography 插件（项目未全局启用 prose）。
 */

import { lazy, Suspense } from "react";
import type { Components } from "react-markdown";
import { contentImageUrl } from "@/shared/lib/image-url";
import { cn } from "@/shared/lib/utils";
import { Checkbox } from "@/shared/ui/base/checkbox";
import { DiagramPlaceholder } from "../../diagram/DiagramPlaceholder";
// 直连 renderers.ts（不经 diagram/index barrel）：barrel 会静态 re-export
// DiagramBlock/renderMermaid，把 mermaid 依赖树拉进文章正文主 chunk；直连仅注册
// 注册表 + lazy factory，mermaid 留在 DiagramBlock 的 lazy chunk（PRD 懒加载决策）。
import { diagramRenderers } from "../../diagram/renderers";

/**
 * FencedCodeBlock 懒加载：避免 shiki 高亮链（CodeBlock → useShikiHighlight →
 * shiki core 单例）进入文章正文主 chunk。只有文章真有围栏代码块时才拉取。
 */
const LazyFencedCodeBlock = lazy(() =>
    import("./CodeBlock").then((m) => ({ default: m.FencedCodeBlock })),
);

/** 公式组件懒加载：KaTeX + 字体只在含公式的文章页拉取 */
const LazyInlineMathFormula = lazy(() =>
    import("../../katex/MathFormula").then((m) => ({ default: m.InlineMathFormula })),
);
const LazyBlockMathFormula = lazy(() =>
    import("../../katex/MathFormula").then((m) => ({ default: m.BlockMathFormula })),
);

/**
 * CodeRunner 懒加载：可运行代码块才加载（CodeMirror + xterm 重依赖）。
 * 避免进入文章正文主 chunk。
 */
const LazyCodeRunner = lazy(() =>
    import("../../code-runner").then((m) => ({ default: m.CodeRunner })),
);

/** 把 react-markdown 传入的 React 节点递归提取为纯文本 */
function nodeToText(node: React.ReactNode): string {
    if (node == null || typeof node === "boolean") return "";
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(nodeToText).join("");
    if (typeof node === "object" && "props" in node) {
        const props = (node as React.ReactElement<{ children?: React.ReactNode }>).props;
        return nodeToText(props.children);
    }
    return "";
}

/**
 * 图块源码降级：mermaid 源以可读 <pre> 呈现。用于
 * - Suspense fallback：mermaid chunk 加载中
 * - 未知 format：注册表未登记
 * - 无 JS：React 不运行时 content_html 的 div 无内容，源码作为文本降级可见
 */
function DiagramSourceFallback({ source }: { source: string }) {
    return (
        <pre className="code-block-scrollbar my-6 overflow-x-auto rounded-lg border border-edge-hairline bg-[#24292e] px-4 py-3 text-sm leading-relaxed text-white/90">
            <code>{source}</code>
        </pre>
    );
}

/**
 * DiagramLoadingFallback - 图块懒加载/异步渲染期间的占位
 *
 * 与 DiagramBlock 的渲染中占位复用同一面板（DiagramPlaceholder），保证 chunk
 * 加载 → mermaid 渲染两段等待视觉一致。引入路径深连 diagram/DiagramPlaceholder
 * 直连（同 renderers.ts 的 barrel 规避，见本文件头部 import 注释）。无 JS 环境下
 * React 不渲染此占位，源码作为 <noscript> 内文本降级可见。
 */
function DiagramLoadingFallback({ source }: { source: string }) {
    return (
        <div className="my-6">
            <DiagramPlaceholder />
            <noscript>
                <pre className="code-block-scrollbar overflow-x-auto px-4 py-3">
                    <code>{source}</code>
                </pre>
            </noscript>
        </div>
    );
}
export const markdownComponents: Components = {
    h1: ({ children, style, className, id }) => (
        <h1
            id={id}
            style={style}
            className={cn("mb-5 mt-10 text-3xl font-bold tracking-tight first:mt-0", className)}
        >
            {children}
        </h1>
    ),
    h2: ({ children, style, className, id }) => (
        <h2
            id={id}
            style={style}
            className={cn(
                "mb-4 mt-10 border-b border-edge-hairline pb-2 text-2xl font-bold tracking-tight first:mt-0",
                className,
            )}
        >
            {children}
        </h2>
    ),
    h3: ({ children, style, className, id }) => (
        <h3
            id={id}
            style={style}
            className={cn("mb-3 mt-8 text-xl font-semibold tracking-tight first:mt-0", className)}
        >
            {children}
        </h3>
    ),
    h4: ({ children, style, className, id }) => (
        <h4
            id={id}
            style={style}
            className={cn("mb-3 mt-6 text-lg font-semibold first:mt-0", className)}
        >
            {children}
        </h4>
    ),
    p: ({ children, style, className }) => (
        <p style={style} className={cn("my-5 text-foreground/90", className)}>
            {children}
        </p>
    ),
    ul: ({ children, ...props }) => {
        const p = props as Record<string, unknown>;
        // hast-util-to-jsx-runtime 对 data-* 属性传 HTML 属性名(连字符)
        // sanitize schema 用 hast 属性名(camelCase)，但 toJsxRuntime 转回 info.attribute
        if (p["data-type"] === "taskList") {
            return (
                <ul data-type="taskList" className="my-5 space-y-2 pl-0 [list-style:none]">
                    {children}
                </ul>
            );
        }
        return <ul className="my-5 list-disc space-y-2 pl-6 text-foreground/90">{children}</ul>;
    },
    ol: ({ children }) => (
        <ol className="my-5 list-decimal space-y-2 pl-6 text-foreground/90">{children}</ol>
    ),
    li: ({ children, ...props }) => {
        const p = props as Record<string, unknown>;
        // HTML 路径：Tiptap task item 带 data-type="taskItem"
        if (p["data-type"] === "taskItem") {
            return (
                <li
                    data-checked={p["data-checked"] as string | undefined}
                    className="flex items-start gap-2"
                >
                    {children}
                </li>
            );
        }
        // Markdown 路径：remark-gfm 的 checked 属性
        const checked = p.checked as boolean | undefined;
        if (checked !== undefined) {
            return (
                <li className="flex items-start gap-2">
                    <Checkbox checked={checked} disabled className="mt-1.5 shrink-0 opacity-100" />
                    <div className="flex-1 min-w-0 [&>p:first-child]:mt-0">{children}</div>
                </li>
            );
        }
        return <li>{children}</li>;
    },
    // HTML 路径的 input[type=checkbox] → 用项目 Checkbox 组件
    input: ({ type, checked, ...rest }) => {
        if (type === "checkbox") {
            return <Checkbox checked={!!checked} disabled className="opacity-100" />;
        }
        return <input type={type} {...rest} />;
    },
    blockquote: ({ children }) => (
        <blockquote className="my-6 border-l-4 border-primary/50 bg-muted/40 py-2 pl-5 text-foreground/80">
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
    // HTML 路径：行内公式（编辑器产出的语义化标记，浏览时渲染）
    span: ({ children, ...props }) => {
        const p = props as Record<string, unknown>;
        if (p["data-type"] === "inline-math") {
            const latex = String(p["data-latex"] ?? "");
            return (
                <Suspense fallback={<span>{latex}</span>}>
                    <LazyInlineMathFormula latex={latex} />
                </Suspense>
            );
        }
        return <span>{children}</span>;
    },
    // HTML 路径：图块（流程图）—— 走渲染器注册表分发，未注册格式降级为源码文本
    // data-source 是 HTML 转义后的原始源码，DOM 解析时已自动反转义，无损提取。
    // Suspense fallback / 未知格式 / 无 JS 均以源码 <pre> 降级（mermaid 源本身可读）。
    div: ({ children, ...props }) => {
        const p = props as Record<string, unknown>;
        if (p["data-type"] === "diagram-block") {
            const format = String(p["data-format"] ?? "");
            const source = String(p["data-source"] ?? "");
            const renderer = diagramRenderers[format];
            if (!renderer) {
                return <DiagramSourceFallback source={source} />;
            }
            const ReaderComponent = renderer.ReaderComponent;
            return (
                <Suspense fallback={<DiagramLoadingFallback source={source} />}>
                    <ReaderComponent format={format} source={source} />
                </Suspense>
            );
        }
        if (p["data-type"] === "block-math") {
            const latex = String(p["data-latex"] ?? "");
            return (
                <Suspense fallback={<div>{latex}</div>}>
                    <LazyBlockMathFormula latex={latex} />
                </Suspense>
            );
        }
        return <div>{children}</div>;
    },
    // 代码：围栏块走 FencedCodeBlock（shiki 高亮 + 语言标签 + 复制），行内走纯样式。
    // 围栏块懒加载，loading 时 Suspense fallback 显示纯文本占位。
    code: ({ className, children }) => {
        const cls = className || "";
        const code = nodeToText(children).replace(/\n$/, "");
        // Markdown 降级路径：remark-math 产出的 math-inline / math-display
        if (/\bmath-inline\b/.test(cls)) {
            return (
                <Suspense fallback={<span>{code}</span>}>
                    <LazyInlineMathFormula latex={code} />
                </Suspense>
            );
        }
        if (/\bmath-display\b/.test(cls)) {
            return (
                <Suspense fallback={<div>{code}</div>}>
                    <LazyBlockMathFormula latex={code} />
                </Suspense>
            );
        }
        const match = /language-(\S+)/.exec(cls);
        const language = match?.[1] ?? "";
        const isFenced = !!match || code.includes("\n");
        if (!isFenced) {
            return (
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-primary">
                    {children}
                </code>
            );
        }
        return (
            <Suspense
                fallback={
                    <pre className="code-block-scrollbar my-6 overflow-x-auto rounded-lg border border-edge-hairline bg-[#24292e] px-4 py-3 text-sm leading-relaxed text-white/90">
                        <code>{code}</code>
                    </pre>
                }
            >
                <LazyFencedCodeBlock code={code} language={language} />
            </Suspense>
        );
    },
    // pre：可运行代码块（data-runnable="true"）渲染 CodeRunner，其余透传给 code 分支。
    // 可运行块的 data-source 携带 HTML 转义后的原始源码（避免反解高亮 HTML）。
    pre: ({ children, ...props }) => {
        const p = props as Record<string, unknown>;
        if (p["data-runnable"] === "true" || p["data-runnable"] === true) {
            const lang = String(p["data-lang"] ?? "");
            const overrides = (() => {
                const raw = p["data-overrides"];
                if (!raw || raw === "") return undefined;
                try {
                    return JSON.parse(String(raw));
                } catch {
                    return undefined;
                }
            })();
            // data-source 是权威源码（HTML 转义后的原始文本），无则降级用 children 文本
            const rawSource = p["data-source"];
            const source = typeof rawSource === "string" ? rawSource : nodeToText(children);
            return (
                <Suspense
                    fallback={
                        <pre className="code-block-scrollbar my-6 overflow-x-auto rounded-lg border border-edge-hairline bg-[#24292e] px-4 py-3 text-sm leading-relaxed text-white/90">
                            <code>{source}</code>
                        </pre>
                    }
                >
                    <LazyCodeRunner
                        language={lang}
                        source={source}
                        overridesJson={overrides ? JSON.stringify(overrides) : undefined}
                    />
                </Suspense>
            );
        }
        return <>{children}</>;
    },
    img: ({ src, alt }) => (
        // 内容图统一走 w=1200 缩略(GIF 剥参数保动画),原图只在点开预览时加载
        <img
            src={typeof src === "string" ? contentImageUrl(src, { width: 1200 }) : undefined}
            alt={alt ?? ""}
            className="my-6 max-w-full rounded-lg"
            loading="lazy"
        />
    ),
};
