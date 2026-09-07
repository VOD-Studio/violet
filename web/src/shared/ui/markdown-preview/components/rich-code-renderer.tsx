import { articleEmbedKind } from "@shared/ui/article-embeds/language";
import type { ArticleContentContext } from "@shared/ui/article-embeds/types";
import type { ReactElement, ReactNode } from "react";
import { lazy, Suspense } from "react";
import type { Components } from "react-markdown";

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
const LazyArticleEmbed = lazy(() =>
	import("../../article-embeds/ArticleEmbed").then((module) => ({
		default: module.ArticleEmbed,
	})),
);
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
		const embedKind = articleEmbedKind(language);
		if (embedKind) {
			return (
				<Suspense
					fallback={
						<div className="my-6 min-h-24 animate-pulse rounded-xl border border-edge-hairline bg-muted/40" />
					}
				>
					<LazyArticleEmbed kind={embedKind} source={code} context={context} />
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
				<LazyCodeCard code={code} language={language} className="my-6" />
			</Suspense>
		);
	};
}
