import { GithubIcon } from "@violet/ui";
import { ArrowUpRight, GitFork, Star } from "lucide-react";

import styles from "./GitHubProjectReference.module.css";
import type { GitHubEmbedConfig } from "./types";

/** GitHub 项目引用的展示参数。 */
interface GitHubProjectReferenceProps {
	/** 随文章保存的仓库标识、简介、可选统计与跳转链接。 */
	config: GitHubEmbedConfig;
}

const COMPACT_NUMBER = new Intl.NumberFormat("en", {
	notation: "compact",
	maximumFractionDigits: 1,
});

/** GitHub 项目引用使用文章内保存的快照，不在阅读时请求仓库元数据。 */
export function GitHubProjectReference({ config }: GitHubProjectReferenceProps) {
	const [owner, name] = config.repo.split("/");
	const href = config.href ?? `https://github.com/${config.repo}`;
	const hasMetadata =
		Boolean(config.language) || config.stars !== undefined || config.forks !== undefined;

	return (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			className={`not-prose ${styles.reference}`}
		>
			<span className={styles.header}>
				<GithubIcon className={styles.mark} aria-hidden />
				<span className={styles.repo}>
					<span className={styles.srOnly}>GitHub 项目：</span>
					<span className={styles.owner}>{owner}</span>
					<span className={styles.slash}> / </span>
					<wbr />
					<strong className={styles.name}>{name}</strong>
				</span>
				<ArrowUpRight className={styles.arrow} aria-hidden />
			</span>
			{config.description ? (
				<span className={styles.description}>{config.description}</span>
			) : null}
			{hasMetadata ? (
				<span className={styles.metadata}>
					{config.language ? (
						<span className={styles.language}>
							<span className={styles.srOnly}>语言：</span>
							{config.language}
						</span>
					) : null}
					{config.stars !== undefined ? (
						<span className={styles.metric} title={`${config.stars} 个星标`}>
							<Star aria-hidden />
							<span aria-hidden>{COMPACT_NUMBER.format(config.stars)}</span>
							<span className={styles.srOnly}>{config.stars} 个星标</span>
						</span>
					) : null}
					{config.forks !== undefined ? (
						<span className={styles.metric} title={`${config.forks} 个 Fork`}>
							<GitFork aria-hidden />
							<span aria-hidden>{COMPACT_NUMBER.format(config.forks)}</span>
							<span className={styles.srOnly}>{config.forks} 个 Fork</span>
						</span>
					) : null}
				</span>
			) : null}
			<span className={styles.srOnly}>（在新标签页打开）</span>
		</a>
	);
}
