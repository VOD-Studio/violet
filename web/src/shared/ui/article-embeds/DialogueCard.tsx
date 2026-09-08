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
		<figure className={styles.root} data-side={config.side}>
			<div className={styles.speaker}>
				{avatar ? (
					<img src={articleEmbedImageUrl(avatar, 160)} alt="" className={styles.avatar} />
				) : (
					<span className={styles.avatarFallback} aria-hidden>
						{speaker.slice(0, 1)}
					</span>
				)}
				<figcaption>{speaker}</figcaption>
			</div>
			<blockquote className={styles.bubble}>
				<p>{config.text}</p>
			</blockquote>
		</figure>
	);
}
