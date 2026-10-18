import { ArticleEmbed } from "@shared/ui/article-embeds/ArticleEmbed";
import { findArticleEmbed } from "@shared/ui/article-embeds/registry";
import type {
	ArticleContentContext,
	ArticleEmbedDefinition,
} from "@shared/ui/article-embeds/types";
import type { ComponentType, LazyExoticComponent, ReactElement, ReactNode } from "react";
import { lazy, Suspense } from "react";
import type { Components } from "react-markdown";
import codeScrollbar from "@/shared/ui/code-scrollbar.module.css";

const LazyCodeCard = lazy(() =>
	import("../../code-preview/components/CodeCard").then((module) => ({
		default: module.CodeCard,
	})),
);
const LazyInlineMathFormula = lazy(() =>
	import("../../katex/MathFormula").then((module) => ({
		default: module.InlineMathFormula,
	})),
);
const LazyBlockMathFormula = lazy(() =>
	import("../../katex/MathFormula").then((module) => ({
		default: module.BlockMathFormula,
	})),
);
type EmbedProps = { source: string; context?: ArticleContentContext };

/** 每种嵌入一个懒加载组件，按定义缓存，渲染之间保持同一个组件身份。 */
const lazyEmbeds = new WeakMap<
	ArticleEmbedDefinition,
	LazyExoticComponent<ComponentType<EmbedProps>>
>();

function lazyEmbed(definition: ArticleEmbedDefinition) {
	let component = lazyEmbeds.get(definition);
	if (!component) {
		component = lazy(() =>
			definition.load().then((module) => ({
				default: ({ source, context }: EmbedProps) => (
					<ArticleEmbed
						kind={definition.kind}
						module={module}
						source={source}
						context={context}
					/>
				),
			})),
		);
		lazyEmbeds.set(definition, component);
	}
	return component;
}
const LazyProfileMention = lazy(() =>
	import("../../article-embeds/ProfileMention").then((module) => ({
		default: module.ProfileMention,
	})),
);

function nodeToText(node: ReactNode): string {
	if (typeof node === "string" || typeof node === "number") return String(node);
	if (Array.isArray(node)) return node.map(nodeToText).join("");
	if (node && typeof node === "object" && "props" in node) {
		return nodeToText((node as ReactElement<{ children?: ReactNode }>).props.children);
	}
	return "";
}

function personaMentionLabel(source: string): string | null {
	const value = source.trim();
	if (/^persona$/iu.test(value)) return "";
	const match = /^persona\s*[:：]\s*(.+)$/iu.exec(value);
	return match?.[1]?.trim() ?? null;
}

/** 为文章实例创建能读取人物上下文的代码节点渲染器。 */
export function createRichCodeRenderer(
	context?: ArticleContentContext,
): NonNullable<Components["code"]> {
	return ({ className, children }) => {
		const cls = className || "";
		const code = nodeToText(children).replace(/\n$/, "");
		const language = /language-(\S+)/u.exec(cls)?.[1] ?? "";
		const embed = findArticleEmbed(language);
		if (embed) {
			const LazyEmbed = lazyEmbed(embed);
			return (
				<Suspense
					fallback={
						<div className="my-6 min-h-24 animate-pulse rounded-xl border border-edge-hairline bg-muted/40" />
					}
				>
					<LazyEmbed source={code} context={context} />
				</Suspense>
			);
		}

		if (/\bmath-inline\b/u.test(cls)) {
			return (
				<Suspense fallback={<span>{code}</span>}>
					<LazyInlineMathFormula latex={code} />
				</Suspense>
			);
		}
		if (/\bmath-display\b/u.test(cls)) {
			return (
				<Suspense fallback={<div>{code}</div>}>
					<LazyBlockMathFormula latex={code} />
				</Suspense>
			);
		}

		const isFenced = Boolean(language) || code.includes("\n");
		if (!isFenced) {
			const mentionLabel = personaMentionLabel(code);
			if (mentionLabel !== null) {
				return (
					<Suspense
						fallback={
							<span>{mentionLabel || context?.profile?.name || "人物档案"}</span>
						}
					>
						<LazyProfileMention label={mentionLabel} profile={context?.profile} />
					</Suspense>
				);
			}
			return (
				<code className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[0.85em] text-primary">
					{children}
				</code>
			);
		}

		return (
			<Suspense
				fallback={
					<div className="not-prose my-6 overflow-hidden rounded-xl border border-border/60 bg-card">
						<div className="border-b border-border/60 px-3 py-1.5 font-mono text-xs text-muted-foreground">
							{language || "text"}
						</div>
						<pre
							className={`${codeScrollbar.scrollbar} overflow-x-auto px-4 py-3 text-sm leading-relaxed text-foreground`}
						>
							<code>{code}</code>
						</pre>
					</div>
				}
			>
				<LazyCodeCard code={code} language={language} className="my-6" />
			</Suspense>
		);
	};
}
