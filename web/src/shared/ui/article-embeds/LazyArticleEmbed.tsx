import { createAsyncLoader } from "@shared/lib/create-async-loader";
import { DeferredContent } from "@shared/ui/deferred-content/DeferredContent";
import type { ComponentType } from "react";
import { ArticleEmbed } from "./ArticleEmbed";
import type { ArticleContentContext, ArticleEmbedDefinition } from "./types";

type EmbedProps = { source: string; context?: ArticleContentContext };
type EmbedLoader = () => Promise<{ default: ComponentType<EmbedProps> }>;

const embedLoaders = new WeakMap<ArticleEmbedDefinition, EmbedLoader>();

function getEmbedLoader(definition: ArticleEmbedDefinition): EmbedLoader {
	let load = embedLoaders.get(definition);
	if (!load) {
		load = createAsyncLoader(() =>
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
		embedLoaders.set(definition, load);
	}
	return load;
}

/**
 * 嵌入定义、原始配置与当前文章上下文。
 *
 * @remarks definition 的对象身份用于复用加载 Promise；调用方不应在渲染期间重建定义。
 */
export interface LazyArticleEmbedProps {
	definition: ArticleEmbedDefinition;
	/** 围栏块里的原文（JSON）。 */
	source: string;
	context?: ArticleContentContext;
}

/**
 * 默认接近视口后加载嵌入；定义关闭 defer 时直接参与 SSR。
 *
 * @remarks 同一定义共享成功的加载结果；失败清除 Promise，重试重新调用加载器。
 * 离开视口不会卸载嵌入，也不会重新解析已完成的内容。
 */
export function LazyArticleEmbed({ definition, source, context }: LazyArticleEmbedProps) {
	return (
		<DeferredContent
			defer={definition.defer}
			load={getEmbedLoader(definition)}
			componentProps={{ source, context }}
			label="嵌入内容"
			fallback={
				<pre
					data-article-embed={definition.kind}
					className="my-6 overflow-x-auto whitespace-pre-wrap rounded-xl border border-edge-hairline bg-muted/40 p-4 text-sm"
				>
					<code>{source}</code>
				</pre>
			}
		/>
	);
}
