/**
 * Markdown 预览组件内联元素映射
 *
 * react-markdown 默认渲染原生 HTML 标签，Tailwind v4 Preflight 会剥掉默认样式。
 * 这里通过 components 自定义关键元素的 className，保证排版美观，
 * 不依赖 @tailwindcss/typography 插件（项目未全局启用 prose）。
 */

import { DeferredContent } from "@shared/ui/deferred-content/DeferredContent";
import { InlineMathContent } from "@shared/ui/katex/InlineMathContent";
import { loadBlockMathFormula } from "@shared/ui/katex/math-formula-loader";
import { RunnableCodeRenderer } from "@shared/ui/markdown-preview/code-renderer-context";
import { ArticleImage } from "@shared/ui/markdown-preview/components/ArticleImage";
import { cn } from "cn";
import type { CSSProperties, ReactNode } from "react";
import type { Components } from "react-markdown";
import { AnchoredHeading } from "@/shared/ui/anchored-heading";
import codeScrollbar from "@/shared/ui/code-scrollbar.module.css";
import type { ArticleContentContext } from "../../article-embeds/types";
// 直连 renderers.ts（不经 diagram/index barrel）：barrel 会静态 re-export
// DiagramBlock/renderMermaid，把 mermaid 依赖树拉进文章正文主 chunk；直连仅注册
// 注册表 + lazy factory，mermaid 留在 DiagramBlock 的 lazy chunk（PRD 懒加载决策）。
import { diagramRenderers } from "../../diagram/renderers";
import { SketchFrame } from "../../sketch-frame/SketchFrame";
import { nodeToText } from "../node-to-text";
import { proseElements } from "./prose-elements";
import { createRichCodeRenderer } from "./rich-code-renderer";

/**
 * 正文标题渲染:h2-h4 渲染管线都会补 slug id,有 id 时复用悬停锚点
 * (与 About 章节同款),无 id 的标题退回普通标题。
 */
interface ProseHeadingProps {
	as: "h2" | "h3" | "h4";
	id?: string;
	style?: CSSProperties;
	className?: string;
	children?: ReactNode;
}

function ProseHeading({ as, id, style, className, children }: ProseHeadingProps) {
	if (!id) {
		const Tag = as;
		return (
			<Tag style={style} className={className}>
				{children}
			</Tag>
		);
	}
	const text = nodeToText(children).trim();
	return (
		<AnchoredHeading
			as={as}
			id={id}
			style={style}
			className={className}
			copyLabel={text ? `复制“${text}”的链接` : undefined}
		>
			{children}
		</AnchoredHeading>
	);
}

/**
 * 图块源码降级：mermaid 源以可读 <pre> 呈现。用于
 * - Suspense fallback：mermaid chunk 加载中
 * - 未知 format：注册表未登记
 * - 无 JS：React 不运行时 content_html 的 div 无内容，源码作为文本降级可见
 */
function DiagramSourceFallback({ source }: { source: string }) {
	return (
		<pre
			data-type="diagram-block"
			data-source={source}
			className={cn(
				codeScrollbar.scrollbar,
				"my-6 overflow-x-auto rounded-lg border border-edge-hairline bg-[#24292e] px-4 py-3 text-sm leading-relaxed text-white/90",
			)}
		>
			<code>{source}</code>
		</pre>
	);
}

export const markdownComponents: Components = {
	...proseElements,
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
		<ProseHeading
			as="h2"
			id={id}
			style={style}
			className={cn(
				"article-h2 mb-4 mt-12 text-2xl font-bold tracking-wide first:mt-0",
				className,
			)}
		>
			{children}
		</ProseHeading>
	),
	h3: ({ children, style, className, id }) => (
		<ProseHeading
			as="h3"
			id={id}
			style={style}
			className={cn(
				"mb-3 mt-9 text-xl font-semibold tracking-wide first:mt-0 before:mr-2 before:font-mono before:text-primary/60 before:content-['#']",
				className,
			)}
		>
			{children}
		</ProseHeading>
	),
	h4: ({ children, style, className, id }) => (
		<ProseHeading
			as="h4"
			id={id}
			style={style}
			className={cn("mb-3 mt-6 text-lg font-semibold first:mt-0", className)}
		>
			{children}
		</ProseHeading>
	),
	p: ({ children, style, className, id }) => (
		<p id={id} style={style} className={cn("my-5 text-foreground/90 text-justify", className)}>
			{children}
		</p>
	),
	strong: ({ children }) => (
		<strong className="bg-linear-to-t from-primary/20 to-transparent to-45% bg-no-repeat font-semibold text-foreground">
			{children}
		</strong>
	),
	em: ({ children }) => <em className="italic">{children}</em>,
	del: ({ children }) => <del className="text-muted-foreground line-through">{children}</del>,
	hr: () => <hr className="article-rule" />,
	table: ({ children }) => (
		<SketchFrame className="my-8" radius={18}>
			<div className="overflow-x-auto rounded-2xl bg-card/60 backdrop-blur-sm">
				<table className="w-full border-collapse text-[0.9375em] leading-relaxed">
					{children}
				</table>
			</div>
		</SketchFrame>
	),
	thead: ({ children }) => <thead className="bg-primary/8">{children}</thead>,
	// HTML 路径：行内公式（编辑器产出的语义化标记，浏览时渲染）
	span: ({ children, style, id, ...props }) => {
		const p = props as Record<string, unknown>;
		if (p["data-type"] === "inline-math") {
			const latex = String(p["data-latex"] ?? "");
			return <InlineMathContent latex={latex} />;
		}
		return (
			<span id={id} style={style}>
				{children}
			</span>
		);
	},
	// HTML 路径：图块（流程图）—— 走渲染器注册表分发，未注册格式降级为源码文本
	// data-source 是 HTML 转义后的原始源码，DOM 解析时已自动反转义，无损提取。
	// Suspense fallback / 未知格式 / 无 JS 均以源码 <pre> 降级（mermaid 源本身可读）。
	div: ({ children, id, role, className, ...props }) => {
		const p = props as Record<string, unknown>;
		if (p["data-type"] === "diagram-block") {
			const format = String(p["data-format"] ?? "");
			const source = String(p["data-source"] ?? "");
			const renderer = diagramRenderers[format];
			if (!renderer) {
				return <DiagramSourceFallback source={source} />;
			}
			return (
				<DeferredContent
					load={renderer.load}
					componentProps={{ format, source }}
					fallback={<DiagramSourceFallback source={source} />}
					label="图表"
				/>
			);
		}
		if (p["data-type"] === "block-math") {
			const latex = String(p["data-latex"] ?? "");
			return (
				<DeferredContent
					load={loadBlockMathFormula}
					componentProps={{ latex }}
					label="公式"
					fallback={
						<div data-type="block-math" data-latex={latex}>
							{latex}
						</div>
					}
				/>
			);
		}
		return (
			<div
				id={id}
				role={role}
				className={className}
				data-type={p["data-type"] === "detailsContent" ? "detailsContent" : undefined}
			>
				{children}
			</div>
		);
	},
	code: createRichCodeRenderer(),
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
				<RunnableCodeRenderer
					language={lang}
					source={source}
					overridesJson={overrides ? JSON.stringify(overrides) : undefined}
				/>
			);
		}
		return <>{children}</>;
	},
	img: ArticleImage,
};

const contextComponents = new WeakMap<ArticleContentContext, Components>();

/**
 * 为单篇内容注入可选人物档案，同时复用其余稳定节点映射。
 *
 * @remarks 按 context 对象缓存：每次新建 code 渲染器会让 React 把全部代码块当作新组件类型重挂载。
 */
export function createMarkdownComponents(context?: ArticleContentContext): Components {
	if (!context) return markdownComponents;
	let components = contextComponents.get(context);
	if (!components) {
		components = { ...markdownComponents, code: createRichCodeRenderer(context) };
		contextComponents.set(context, components);
	}
	return components;
}
