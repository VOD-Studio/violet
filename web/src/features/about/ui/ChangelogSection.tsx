import { cleanItem } from "@features/changelog/model/clean-item";
import { useReleases } from "@shared/api/releases";
import { formatDate } from "@shared/lib/date";
import { Disclosure } from "@shared/ui/disclosure";
import { Timeline, TimelineItem } from "@shared/ui/timeline";
import { Link } from "@tanstack/react-router";
import { iconProps, Skeleton } from "@violet/ui";
import { ArrowRight, ArrowUpRight } from "lucide-react";

import { AboutChapter } from "./AboutChapter";
import { AboutSectionState } from "./AboutSectionState";
import styles from "./AboutSections.module.css";
import type { AboutSectionProps } from "./types";

/** 展示最近几次发布，并允许在时间线原位展开版本摘要。 */
export function ChangelogSection(_: AboutSectionProps) {
	const { data, isPending, isError, isFetching, refetch } = useReleases();

	if (isPending) {
		return (
			<AboutChapter
				id="changelog"
				title="最近开的花"
				intro="最近三次正式发布，记录这里的变化。"
			>
				<Skeleton className={styles.loadingRelease} />
			</AboutChapter>
		);
	}

	if (isError) {
		return (
			<AboutChapter
				id="changelog"
				title="最近开的花"
				intro="最近三次正式发布，记录这里的变化。"
			>
				<AboutSectionState
					message="更新日志暂时未能抵达。"
					isRetrying={isFetching}
					onRetry={() => void refetch()}
				/>
			</AboutChapter>
		);
	}

	const releases = data?.releases.slice(0, 3) ?? [];
	if (releases.length === 0) {
		return (
			<AboutChapter
				id="changelog"
				title="最近开的花"
				intro="最近三次正式发布，记录这里的变化。"
			>
				<AboutSectionState message="暂时没有公开的更新记录。" />
			</AboutChapter>
		);
	}

	return (
		<AboutChapter id="changelog" title="最近开的花" intro="最近三次正式发布，记录这里的变化。">
			<Timeline ariaLabel="最近三次公开发布" className={styles.releaseTimeline}>
				{releases.map((release) => {
					const categories = release.categories
						.map((category) => ({
							label: category.label,
							items: category.items
								.map((item) => cleanItem(item).text.trim())
								.filter(Boolean),
						}))
						.filter((category) => category.items.length > 0);
					const releaseName = release.name.trim();
					const headline =
						releaseName && releaseName !== release.tag
							? releaseName
							: categories[0]?.items[0];

					return (
						<TimelineItem
							key={release.tag}
							date={formatDate(release.published_at)}
							dateTime={release.published_at}
						>
							<Disclosure
								variant="panel"
								summary={
									<span className={styles.releaseSummaryContent}>
										<span className={styles.releaseVersion}>{release.tag}</span>
										{headline ? (
											<span className={styles.releaseName}>{headline}</span>
										) : null}
									</span>
								}
							>
								{categories.length > 0 ? (
									categories.map((category) => (
										<section
											key={category.label}
											className={styles.releaseCategory}
										>
											<h3 className={styles.releaseCategoryTitle}>
												{category.label}
											</h3>
											<ul className={styles.releaseItems}>
												{category.items.map((item, index) => (
													<li
														key={`${category.label}-${index}`}
														className={styles.releaseItem}
													>
														{item}
													</li>
												))}
											</ul>
										</section>
									))
								) : (
									<AboutSectionState message="这个版本没有公开摘要。" />
								)}
								<div className={styles.releaseActions}>
									{release.html_url ? (
										<a
											href={release.html_url}
											target="_blank"
											rel="noopener noreferrer"
											className={styles.releaseLink}
										>
											GitHub Release
											<ArrowUpRight
												{...iconProps(14, styles.releaseLinkIcon)}
												aria-hidden
											/>
										</a>
									) : null}
								</div>
							</Disclosure>
						</TimelineItem>
					);
				})}
			</Timeline>
			<Link to="/changelog" className={styles.allReleasesLink}>
				查看完整更新日志
				<ArrowRight {...iconProps(14, styles.releaseLinkIcon)} aria-hidden />
			</Link>
		</AboutChapter>
	);
}
