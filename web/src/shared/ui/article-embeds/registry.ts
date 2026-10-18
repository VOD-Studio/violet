import { BUILTIN_EMBEDS } from "./builtins";
import type { ArticleEmbedDefinition } from "./types";

const byLanguage = new Map<string, ArticleEmbedDefinition>();

const normalize = (language: string) => language.trim().toLowerCase();

/**
 * 登记一种文章嵌入，之后文章里用它的围栏语言写的代码块就按它渲染。
 *
 * 内置的对话、项目引用、链接摘要、推文与社交入口已经登记；feature 的嵌入在应用启动时登记，
 * 服务端渲染与客户端都要登记，否则两边渲染不一致。同一份定义重复登记不报错。
 *
 * @throws 某个围栏语言已经属于另一种嵌入时
 */
export function registerArticleEmbed<Config>(definition: ArticleEmbedDefinition<Config>): void {
	for (const language of definition.languages) {
		const key = normalize(language);
		const existing = byLanguage.get(key);
		if (existing && existing.kind !== definition.kind)
			throw new Error(`围栏语言「${key}」已经属于 ${existing.kind} 嵌入`);
		byLanguage.set(key, definition as ArticleEmbedDefinition);
	}
}

/** 按围栏语言找已登记的嵌入；不是嵌入（普通代码块）时返回 null。 */
export function findArticleEmbed(language: string): ArticleEmbedDefinition | null {
	return byLanguage.get(normalize(language)) ?? null;
}

/** 已登记的嵌入，每种一份，按登记先后排列。 */
export function listArticleEmbeds(): ArticleEmbedDefinition[] {
	return [...new Set(byLanguage.values())];
}

for (const definition of BUILTIN_EMBEDS) registerArticleEmbed(definition);
