import { GithubIcon } from "@violet/ui";
import { GitFork, Star } from "lucide-react";

import styles from "./GitHubProjectReference.module.css";
import type { GitHubEmbedConfig } from "./types";

interface GitHubProjectReferenceProps {
	config: GitHubEmbedConfig;
}

const COMPACT_NUMBER = new Intl.NumberFormat("en", {
	notation: "compact",
	maximumFractionDigits: 1,
});

/** GitHub 项目引用使用文章内保存的快照，不在阅读时请求仓库元数据。 */
export function GitHubProjectReference({ config }: GitHubProjectReferenceProps) {
	const [owner, name] = config.repo.split("/");
	const ownerHref = `https://github.com/${encodeURIComponent(owner)}`;
	const repoHref = `https://github.com/${config.repo}`;
	const href = config.href ?? repoHref;
	const hasMetadata =
		Boolean(config.language) || config.stars !== undefined || config.forks !== undefined;

	return (
		<article
			className={`not-prose ${styles.reference}`}
			aria-label={`GitHub 项目：${config.repo}`}
		>
			<header className={styles.header}>
				<a
					href={ownerHref}
					target="_blank"
					rel="noopener noreferrer"
					className={styles.avatar}
					aria-label={`${owner} 的 GitHub 主页`}
				>
					<GithubIcon className={styles.avatarFallback} aria-hidden />
					<img
						src={`${ownerHref}.png?size=80`}
						alt=""
						width={40}
						height={40}
						loading="lazy"
						decoding="async"
						referrerPolicy="no-referrer"
						onError={(event) => {
							event.currentTarget.hidden = true;
						}}
					/>
				</a>
				<div className={styles.repo}>
					<a
						href={href}
						target="_blank"
						rel="noopener noreferrer"
						className={styles.name}
					>
						{name}
					</a>
					<a
						href={ownerHref}
						target="_blank"
						rel="noopener noreferrer"
						className={styles.owner}
					>
						{owner}
					</a>
				</div>
				<a
					href={href}
					target="_blank"
					rel="noopener noreferrer"
					className={styles.brand}
					aria-label="在 GitHub 上查看项目"
				>
					<GithubIcon aria-hidden />
				</a>
			</header>
			{config.description ? <p className={styles.description}>{config.description}</p> : null}
			{hasMetadata ? (
				<div className={styles.metadata}>
					{config.language ? (
						<span className={styles.language} data-language={config.language}>
							<span className={styles.srOnly}>语言：</span>
							{config.language}
						</span>
					) : null}
					{config.stars !== undefined ? (
						<a
							href={repoHref}
							target="_blank"
							rel="noopener noreferrer"
							className={styles.metric}
							title="在 GitHub 上 Star 此项目"
						>
							<Star aria-hidden />
							<span className={styles.count} aria-hidden>
								{COMPACT_NUMBER.format(config.stars)}
							</span>
							<span aria-hidden>Stars</span>
							<span className={styles.srOnly}>
								{config.stars} 个星标，在 GitHub 上 Star 此项目（新标签页）
							</span>
						</a>
					) : null}
					{config.forks !== undefined ? (
						<a
							href={`${repoHref}/fork`}
							target="_blank"
							rel="noopener noreferrer"
							className={styles.metric}
							title="在 GitHub 上 Fork 此项目"
						>
							<GitFork aria-hidden />
							<span className={styles.count} aria-hidden>
								{COMPACT_NUMBER.format(config.forks)}
							</span>
							<span aria-hidden>Forks</span>
							<span className={styles.srOnly}>
								{config.forks} 个 Fork，在 GitHub 上创建 Fork（新标签页）
							</span>
						</a>
					) : null}
				</div>
			) : null}
		</article>
	);
}
