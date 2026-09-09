import { cleanItem } from "@features/changelog/model/clean-item";
import { useReleases } from "@shared/api/releases";
import { formatDate } from "@shared/lib/date";
import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import styles from "./AboutPage.module.css";
import { AboutSectionIntro } from "./AboutSectionIntro";
import type { AboutSectionProps } from "./AboutSectionPlaceholder";

const PREVIEW_ITEMS = 6;

/** 将最近发布记录排成关于页的变更索引。 */
export function ChangelogSection(_: AboutSectionProps) {
	const { data, isPending } = useReleases();

	if (isPending) {
		return (
			<section className={styles.section} aria-labelledby="about-changelog-title">
				<AboutSectionIntro
					id="about-changelog-title"
					eyebrow="Changelog / 07"
					title="最近，它发生了什么。"
				/>
				<div className={styles.changeGrid}>
					{Array.from({ length: PREVIEW_ITEMS }, (_, index) => (
						<div key={index} className={styles.changeItem}>
							<ShimmerSkeleton className={styles.skeletonKicker} />
							<ShimmerSkeleton className={styles.changeSkeletonLine} />
						</div>
					))}
				</div>
			</section>
		);
	}

	if (!data || data.releases.length === 0) return null;

	const latest = data.releases[0];
	const changes = data.releases
		.flatMap((release) =>
			release.categories.flatMap((category) =>
				category.items.map((item) => {
					const cleaned = cleanItem(item);
					return {
						key: `${release.tag}-${category.label}-${item}`,
						category: cleaned.scope
							? `${category.label} · ${cleaned.scope}`
							: category.label,
						text: cleaned.text,
					};
				}),
			),
		)
		.slice(0, PREVIEW_ITEMS);

	return (
		<section className={styles.section} aria-labelledby="about-changelog-title">
			<AboutSectionIntro
				id="about-changelog-title"
				eyebrow="Changelog / 07"
				title="最近，它发生了什么。"
			/>
			<div className={styles.changelogTop}>
				<span className={styles.versionStamp}>{latest.tag}</span>
				{latest.published_at ? (
					<span className={styles.releaseMeta}>{formatDate(latest.published_at)}</span>
				) : null}
			</div>
			<div className={styles.changeGrid}>
				{changes.map((change, index) => (
					<article key={change.key} className={styles.changeItem}>
						<span className={styles.changeCategory}>{change.category}</span>
						<h3 className={styles.changeTitle}>{change.text}</h3>
						<span className={styles.changeSerial} aria-hidden="true">
							{String(index + 1).padStart(2, "0")}
						</span>
					</article>
				))}
			</div>
			<Link to="/changelog" className={styles.changelogLink}>
				查看完整更新日志
				<ArrowRight aria-hidden="true" />
			</Link>
		</section>
	);
}
