import type { ArticleEmbedDefinition } from "./types";

/** 内置嵌入的实现在同一个按需加载的模块里，只在文章用到时才下载。 */
const builtin = (kind: "dialogue" | "github" | "link-preview" | "tweet" | "social-links") => () =>
	import("./builtin-embeds").then((module) => module.BUILTIN_EMBED_MODULES[kind]);

/** 内置的五种嵌入与它们识别的围栏语言（第一个是主名，其余是别名）。 */
export const BUILTIN_EMBEDS: readonly ArticleEmbedDefinition[] = [
	{ kind: "dialogue", languages: ["dialogue", "chat"], load: builtin("dialogue") },
	{ kind: "github", languages: ["github", "repository"], load: builtin("github") },
	{
		kind: "link-preview",
		languages: ["link-preview", "linkcard"],
		load: builtin("link-preview"),
	},
	{ kind: "tweet", languages: ["tweet", "x"], load: builtin("tweet") },
	{ kind: "social-links", languages: ["social-links", "socials"], load: builtin("social-links") },
] as ArticleEmbedDefinition[];
