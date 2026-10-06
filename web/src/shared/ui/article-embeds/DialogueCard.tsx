import styles from "./DialogueCard.module.css";
import type { ArticleContentContext, DialogueEmbedConfig } from "./types";
import { articleEmbedImageUrl } from "./url";

interface DialogueCardProps {
	config: DialogueEmbedConfig;
	context?: ArticleContentContext;
}

/** 文章内的单轮对话气泡，可从当前人物档案补齐说话者身份。 */
export function DialogueCard({ config, context }: DialogueCardProps) {
	const profile = config.profile === "active" ? context?.profile : undefined;
	const speaker = config.speaker || profile?.name || "对话";
	const avatar = config.avatar || profile?.avatarUrl;

	return (
		<figure className={`not-prose ${styles.root}`} data-side={config.side}>
			{avatar ? (
				<img
					src={articleEmbedImageUrl(avatar, 160)}
					alt=""
					width={32}
					height={32}
					loading="lazy"
					className={styles.avatar}
				/>
			) : (
				<span className={styles.avatarFallback} aria-hidden>
					{Array.from(speaker)[0]}
				</span>
			)}
			<figcaption className={styles.speaker}>{speaker}</figcaption>
			<blockquote className={styles.bubble}>
				<p>{config.text}</p>
			</blockquote>
		</figure>
	);
}
