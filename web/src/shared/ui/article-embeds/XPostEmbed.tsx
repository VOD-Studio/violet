import { ArrowUpRight } from "lucide-react";
import { EmbeddedTweet, useTweet } from "react-tweet";
import styles from "./XPostEmbed.module.css";

interface XPostEmbedProps {
	id: string;
	href: string;
}

/** 从 X 动态 ID 解析实时静态卡片，失败时保留原链接。 */
export function XPostEmbed({ id, href }: XPostEmbedProps) {
	const { data, error, isLoading } = useTweet(id);

	if (isLoading) {
		return (
			<div
				className={`${styles.embed} ${styles.loading}`}
				role="status"
				aria-label="正在解析 X 动态"
			>
				<div className={styles.loadingHeader}>
					<span className={styles.loadingAvatar} />
					<span className={styles.loadingName} />
				</div>
				<span className={styles.loadingLine} />
				<span className={styles.loadingLineShort} />
			</div>
		);
	}

	if (error || !data) {
		return (
			<div className={styles.embed} data-article-embed="x-post">
				<a
					className={styles.fallback}
					href={href}
					target="_blank"
					rel="noopener noreferrer"
				>
					<span>
						<span className={styles.fallbackTitle}>这条 X 动态暂时无法解析</span>
						<span className={styles.fallbackHint}>前往 X 查看原动态</span>
					</span>
					<ArrowUpRight className={styles.fallbackIcon} aria-hidden="true" />
				</a>
			</div>
		);
	}

	return (
		<div className={styles.embed} data-article-embed="x-post">
			<div className={styles.card}>
				<EmbeddedTweet tweet={data} />
			</div>
		</div>
	);
}
