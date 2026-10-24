import { LazyArticleEmbed } from "@shared/ui/article-embeds/LazyArticleEmbed";
import { findArticleEmbed } from "@shared/ui/article-embeds/registry";
import type { ArticleContentContext } from "@shared/ui/article-embeds/types";
import { DeferredContent } from "@shared/ui/deferred-content/DeferredContent";
import { InlineMathContent } from "@shared/ui/katex/InlineMathContent";
import { loadBlockMathFormula } from "@shared/ui/katex/math-formula-loader";
import { lazy, Suspense } from "react";
import type { Components } from "react-markdown";
import codeScrollbar from "@/shared/ui/code-scrollbar.module.css";
import { nodeToText } from "../node-to-text";

const loadCodeCard = () =>
	import("../../code-preview/components/CodeCard").then((module) => ({
		default: module.CodeCard,
	}));
const LazyProfileMention = lazy(() =>
	import("../../article-embeds/ProfileMention").then((module) => ({
		default: module.ProfileMention,
	})),
);

function personaMentionLabel(source: string): string | null {
	const value = source.trim();
	if (/^persona$/iu.test(value)) return "";
	const match = /^persona\s*[:：]\s*(.+)$/iu.exec(value);
	return match?.[1]?.trim() ?? null;
}

/**
 * 为文章实例创建读取人物上下文的代码节点渲染器。
 *
 * @remarks 普通围栏先输出完整源码；块级增强由视口边界加载，行内语义不延后。
 * @param context - 当前文章的人物上下文；调用方须复用同一上下文的渲染器以保留已完成结果。
 */
export function createRichCodeRenderer(
	context?: ArticleContentContext,
): NonNullable<Components["code"]> {
	return ({ className, children }) => {
		const cls = className || "";
		const code = nodeToText(children).replace(/\n$/, "");
		const language = /language-(\S+)/u.exec(cls)?.[1] ?? "";
		const embed = findArticleEmbed(language);
		if (embed) return <LazyArticleEmbed definition={embed} source={code} context={context} />;

		if (/\bmath-inline\b/u.test(cls)) {
			return <InlineMathContent latex={code} />;
		}
		if (/\bmath-display\b/u.test(cls)) {
			return (
				<DeferredContent
					load={loadBlockMathFormula}
					componentProps={{ latex: code }}
					label="公式"
					fallback={
						<div data-type="block-math" data-latex={code}>
							{code}
						</div>
					}
				/>
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
			<DeferredContent
				load={loadCodeCard}
				componentProps={{ code, language, className: "my-6", collapseLines: 0 }}
				label="代码高亮"
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
			/>
		);
	};
}
