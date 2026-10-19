import { type ComponentType, type LazyExoticComponent, lazy, Suspense } from "react";
import { ArticleEmbed } from "./ArticleEmbed";
import type { ArticleContentContext, ArticleEmbedDefinition } from "./types";

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

export interface LazyArticleEmbedProps {
	definition: ArticleEmbedDefinition;
	/** 围栏块里的原文（JSON）。 */
	source: string;
	context?: ArticleContentContext;
}

/** 按需加载一种嵌入并渲染围栏块；实现下载完成前是同样外框的占位。 */
export function LazyArticleEmbed({ definition, source, context }: LazyArticleEmbedProps) {
	const Embed = lazyEmbed(definition);
	return (
		<Suspense
			fallback={
				<div className="my-6 min-h-24 animate-pulse rounded-xl border border-edge-hairline bg-muted/40" />
			}
		>
			<Embed source={source} context={context} />
		</Suspense>
	);
}
