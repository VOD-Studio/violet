import { parseHighlightedLines } from "@shared/lib/markdown/fence-info";
import { LazyArticleEmbed } from "@shared/ui/article-embeds/LazyArticleEmbed";
import { findArticleEmbed } from "@shared/ui/article-embeds/registry";
import type { ArticleContentContext } from "@shared/ui/article-embeds/types";
import { DeferredContent } from "@shared/ui/deferred-content/DeferredContent";
import { BlockMathSource } from "@shared/ui/katex/BlockMathSource";
import { InlineMathContent } from "@shared/ui/katex/InlineMathContent";
import { loadBlockMathFormula } from "@shared/ui/katex/math-formula-loader";
import { CodeBlock, InlineCode } from "@violet/ui";
import { type ComponentProps, lazy, Suspense } from "react";
import type { Components, ExtraProps } from "react-markdown";
import { RunnableCodeRenderer } from "../code-renderer-context";
import { nodeToText } from "../node-to-text";

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

interface RichCodeProps extends ComponentProps<"code">, ExtraProps {
	source?: string;
	fenced?: boolean;
	filename?: string;
	highlightedLines?: readonly number[];
}

/**
 * 为文章实例创建读取人物上下文的代码节点渲染器。
 *
 * @remarks 普通围栏先输出完整源码；块级增强由视口边界加载，行内语义不延后。
 * @param context - 当前文章的人物上下文；调用方须复用同一上下文的渲染器以保留已完成结果。
 */
export function createRichCodeRenderer(
	context?: ArticleContentContext,
): (props: RichCodeProps) => React.ReactNode {
	return ({ className, children, source, fenced, filename, highlightedLines }) => {
		const cls = className || "";
		const code = source ?? nodeToText(children).replace(/\n$/, "");
		const language = /language-(\S+)/u.exec(cls)?.[1] ?? "";
		const embed = findArticleEmbed(language);
		if (embed)
			return (
				<div data-article-embed={embed.kind} style={{ display: "contents" }}>
					<LazyArticleEmbed definition={embed} source={code} context={context} />
				</div>
			);

		if (/\bmath-inline\b/u.test(cls)) {
			return <InlineMathContent latex={code} />;
		}
		if (/\bmath-display\b/u.test(cls)) {
			return (
				<DeferredContent
					defer="idle"
					load={loadBlockMathFormula}
					componentProps={{ latex: code }}
					label="公式"
					fallback={<BlockMathSource latex={code} />}
				/>
			);
		}

		const isFenced = fenced || Boolean(language) || code.includes("\n");
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
			return <InlineCode>{children}</InlineCode>;
		}

		return (
			<CodeBlock
				code={code}
				language={language}
				filename={filename}
				highlightedLines={highlightedLines}
				className="my-6"
			/>
		);
	};
}

/** 从 pre 载体读取权威源码与作者元数据，再分发到只读或运行界面。 */
export function createRichPreRenderer(
	context?: ArticleContentContext,
): NonNullable<Components["pre"]> {
	const RichCode = createRichCodeRenderer(context);
	return ({ children, node, ...props }) => {
		const attributes = props as Record<string, unknown>;
		const rawSource = attributes["data-source"];
		const source =
			typeof rawSource === "string" ? rawSource : nodeToText(children).replace(/\n$/u, "");
		const codeNode = node?.children.find(
			(child) => child.type === "element" && child.tagName === "code",
		);
		const classNames = codeNode?.type === "element" ? codeNode.properties.className : undefined;
		const className = Array.isArray(classNames)
			? classNames.join(" ")
			: String(classNames ?? "");
		const language = String(
			attributes["data-lang"] ?? /language-(\S+)/u.exec(className)?.[1] ?? "",
		);
		const filename =
			typeof attributes["data-filename"] === "string"
				? attributes["data-filename"]
				: undefined;
		const lineSpec =
			typeof attributes["data-lines"] === "string" ? attributes["data-lines"] : undefined;
		const highlightedLines = parseHighlightedLines(lineSpec, source.split("\n").length);

		if (attributes["data-runnable"] === "true" || attributes["data-runnable"] === true) {
			return (
				<RunnableCodeRenderer
					language={language}
					source={source}
					filename={filename}
					highlightedLines={highlightedLines}
					overridesJson={
						typeof attributes["data-overrides"] === "string"
							? attributes["data-overrides"]
							: undefined
					}
				/>
			);
		}

		return (
			<RichCode
				source={source}
				fenced
				className={className || (language ? `language-${language}` : undefined)}
				filename={filename}
				highlightedLines={highlightedLines}
			/>
		);
	};
}
