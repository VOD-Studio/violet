import { AlertCircle } from "lucide-react";
import styles from "./ArticleEmbed.module.css";
import { DialogueCard } from "./DialogueCard";
import { LinkPreviewCard } from "./LinkPreviewCard";
import { RepositoryCard } from "./RepositoryCard";
import { SocialLinksCard } from "./SocialLinksCard";
import { parseArticleEmbed } from "./schema";
import { TweetEmbedCard } from "./TweetEmbedCard";
import type { ArticleContentContext, ArticleEmbedKind } from "./types";

interface ArticleEmbedProps {
	kind: ArticleEmbedKind;
	source: string;
	context?: ArticleContentContext;
}

/** 将受支持的围栏代码配置渲染为文章卡片，并为坏配置保留可诊断降级。 */
export function ArticleEmbed({ kind, source, context }: ArticleEmbedProps) {
	const parsed = parseArticleEmbed(kind, source);
	if (!parsed) {
		return (
			<aside className={styles.invalid} role="note">
				<p>
					<AlertCircle aria-hidden />
					无法解析 {kind} 卡片配置
				</p>
				<pre>{source}</pre>
			</aside>
		);
	}

	switch (parsed.kind) {
		case "dialogue":
			return <DialogueCard config={parsed.config} context={context} />;
		case "github":
			return <RepositoryCard config={parsed.config} />;
		case "link-preview":
			return <LinkPreviewCard config={parsed.config} />;
		case "tweet":
			return <TweetEmbedCard config={parsed.config} />;
		case "social-links":
			return <SocialLinksCard config={parsed.config} />;
	}
}
