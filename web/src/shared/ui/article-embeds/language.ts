import type { ArticleEmbedKind } from "./types";

const LANGUAGE_KIND: Record<string, ArticleEmbedKind | undefined> = {
	dialogue: "dialogue",
	chat: "dialogue",
	github: "github",
	repository: "github",
	"link-preview": "link-preview",
	linkcard: "link-preview",
	tweet: "tweet",
	x: "tweet",
	"social-links": "social-links",
	socials: "social-links",
};

/** 把围栏代码语言归一为受支持的文章卡片类型。 */
export function articleEmbedKind(language: string): ArticleEmbedKind | null {
	return LANGUAGE_KIND[language.trim().toLowerCase()] ?? null;
}
