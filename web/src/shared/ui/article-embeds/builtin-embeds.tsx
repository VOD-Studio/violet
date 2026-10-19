import { DialogueCard } from "./DialogueCard";
import { GitHubProjectReference } from "./GitHubProjectReference";
import { LinkPreviewCard } from "./LinkPreviewCard";
import { SocialLinksCard } from "./SocialLinksCard";
import { BUILTIN_SCHEMAS, parseWith } from "./schema";
import { TweetEmbedCard } from "./TweetEmbedCard";
import type { ArticleEmbedConfigMap, ArticleEmbedKind, ArticleEmbedModule } from "./types";

/** 内置嵌入的实现：配置校验与卡片组件。按需加载，见 builtins.ts。 */
export const BUILTIN_EMBED_MODULES: {
	[Kind in ArticleEmbedKind]: ArticleEmbedModule<ArticleEmbedConfigMap[Kind]>;
} = {
	dialogue: { parse: parseWith(BUILTIN_SCHEMAS.dialogue), Component: DialogueCard },
	github: { parse: parseWith(BUILTIN_SCHEMAS.github), Component: GitHubProjectReference },
	"link-preview": {
		parse: parseWith(BUILTIN_SCHEMAS["link-preview"]),
		Component: LinkPreviewCard,
	},
	tweet: { parse: parseWith(BUILTIN_SCHEMAS.tweet), Component: TweetEmbedCard },
	"social-links": {
		parse: parseWith(BUILTIN_SCHEMAS["social-links"]),
		Component: SocialLinksCard,
	},
};
