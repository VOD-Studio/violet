import { BadgeCheck, ExternalLink } from "lucide-react";
import type { SVGProps } from "react";
import styles from "./TweetEmbedCard.module.css";
import type { TweetEmbedConfig } from "./types";
import { articleEmbedImageUrl } from "./url";

interface TweetEmbedCardProps {
	config: TweetEmbedConfig;
}

/** 文章内的静态社交动态快照，保留原文链接且不加载第三方脚本。 */
export function TweetEmbedCard({ config }: TweetEmbedCardProps) {
	const handle = config.handle.startsWith("@") ? config.handle : `@${config.handle}`;

	return (
		<article className={styles.shell} aria-label={`${config.author} 发布的动态`}>
			<a
				href={config.url}
				target="_blank"
				rel="noopener noreferrer"
				className={styles.card}
				aria-label={`在 X 上查看 ${config.author} 的动态`}
			>
				<header className={styles.header}>
					{config.avatar ? (
						<img
							src={articleEmbedImageUrl(config.avatar, 160)}
							alt=""
							className={styles.avatar}
							loading="lazy"
						/>
					) : (
						<span className={styles.avatarFallback} aria-hidden>
							{config.author.slice(0, 1)}
						</span>
					)}
					<div className={styles.identity}>
						<p>
							<strong>{config.author}</strong>
							{config.verified ? <BadgeCheck aria-label="已认证" /> : null}
						</p>
						<span>{handle}</span>
					</div>
					<span className={styles.platform} aria-hidden>
						<XIcon />
					</span>
				</header>

				<p className={styles.text}>{config.text}</p>
				{config.image ? (
					<span className={styles.mediaLink}>
						<img
							src={articleEmbedImageUrl(config.image, 1200)}
							alt={config.imageAlt || "动态配图"}
							className={styles.media}
							loading="lazy"
						/>
					</span>
				) : null}
				<footer>
					<span>
						{config.date || "查看原动态"}
						<ExternalLink aria-hidden />
					</span>
				</footer>
			</a>
		</article>
	);
}

function XIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<svg {...props} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
			<title>X</title>
			<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.657l-5.214-6.817-5.967 6.817H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
		</svg>
	);
}
