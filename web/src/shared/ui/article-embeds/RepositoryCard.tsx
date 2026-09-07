import { GithubIcon } from "@shared/ui/icons";
import { ArrowUpRight, GitFork, Star } from "lucide-react";
import styles from "./RepositoryCard.module.css";
import type { GitHubEmbedConfig } from "./types";

interface RepositoryCardProps {
	config: GitHubEmbedConfig;
}

const COMPACT_NUMBER = new Intl.NumberFormat("en", {
	notation: "compact",
	maximumFractionDigits: 1,
});

/** 静态仓库快照；元数据随文章保存，避免阅读时依赖 GitHub 限流接口。 */
export function RepositoryCard({ config }: RepositoryCardProps) {
	const [owner, name] = config.repo.split("/");
	const href = config.href || `https://github.com/${config.repo}`;

	return (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			className={styles.card}
			aria-label={`打开 GitHub 仓库 ${config.repo}`}
		>
			<div className={styles.topline}>
				<span className={styles.iconWrap}>
					<GithubIcon aria-hidden />
				</span>
				<span className={styles.kind}>OPEN SOURCE</span>
				<ArrowUpRight className={styles.arrow} aria-hidden />
			</div>
			<p className={styles.repo}>
				<span>{owner}</span>
				<span aria-hidden>/</span>
				<strong>{name}</strong>
			</p>
			{config.description ? <p className={styles.description}>{config.description}</p> : null}
			<div className={styles.meta}>
				{config.language ? (
					<span>
						<i aria-hidden />
						{config.language}
					</span>
				) : null}
				{config.stars !== undefined ? (
					<span>
						<Star aria-hidden />
						{COMPACT_NUMBER.format(config.stars)}
					</span>
				) : null}
				{config.forks !== undefined ? (
					<span>
						<GitFork aria-hidden />
						{COMPACT_NUMBER.format(config.forks)}
					</span>
				) : null}
			</div>
		</a>
	);
}
