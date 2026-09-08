import { useActivePersona } from "@entities/persona/api/queries";
import type { ArticleContentContext } from "@shared/ui/article-embeds/types";
import ArticleContent, {
	type ArticleContentProps,
} from "@shared/ui/markdown-preview/ArticleContent";
import { useMemo } from "react";

type ArticleRichContentProps = Omit<ArticleContentProps, "context">;
const PERSONA_MENTION_RE =
	/(?:`|<code(?:\s[^>]*)?>)\s*persona(?:\s*[:：][^`<]+)?\s*(?:`|<\/code>)/iu;

function PersonaAwareArticleContent(props: ArticleRichContentProps) {
	const { data: persona } = useActivePersona();
	const context = useMemo<ArticleContentContext | undefined>(() => {
		if (!persona) return undefined;
		return {
			profile: {
				name: persona.name,
				subtitle: persona.subtitle,
				description: persona.summary,
				avatarUrl: persona.avatar?.thumbnail || persona.avatar?.url,
				href: "/persona",
			},
		};
	}, [persona]);
	return <ArticleContent {...props} context={context} />;
}

/** 仅在正文包含 persona 行内标记时加载当前人物档案，其余文章保持零额外请求。 */
export function ArticleRichContent(props: ArticleRichContentProps) {
	if (!PERSONA_MENTION_RE.test(props.content)) {
		return <ArticleContent {...props} />;
	}
	return <PersonaAwareArticleContent {...props} />;
}
