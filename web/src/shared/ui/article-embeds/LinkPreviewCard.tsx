import { ArrowUpRight, Link2 } from "lucide-react";
import styles from "./LinkPreviewCard.module.css";
import type { LinkPreviewEmbedConfig } from "./types";
import { articleEmbedImageUrl, articleLinkHostname } from "./url";

interface LinkPreviewCardProps {
	config: LinkPreviewEmbedConfig;
}

/** 由文章保存的元数据渲染稳定链接摘要，不在阅读时重新抓取目标网站。 */
export function LinkPreviewCard({ config }: LinkPreviewCardProps) {
	const source = config.site || articleLinkHostname(config.url);

	return (
		<a
			href={config.url}
			target="_blank"
			rel="noopener noreferrer"
			className={styles.card}
			aria-label={`打开链接：${config.title}`}
		>
			{config.image ? (
				<img
					src={articleEmbedImageUrl(config.image, 480)}
					alt=""
					className={styles.image}
					loading="lazy"
				/>
			) : (
				<span className={styles.imageFallback} aria-hidden>
					<Link2 />
				</span>
			)}
			<span className={styles.copy}>
				<span className={styles.source}>{source}</span>
				<strong>{config.title}</strong>
				{config.description ? (
					<span className={styles.description}>{config.description}</span>
				) : null}
			</span>
			<ArrowUpRight className={styles.arrow} aria-hidden />
		</a>
	);
}
