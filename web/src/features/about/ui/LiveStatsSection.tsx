import { usePublicStats } from "@features/about/api/queries";
import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";
import { useEffect, useRef, useState } from "react";
import styles from "./AboutPage.module.css";
import { AboutSectionIntro } from "./AboutSectionIntro";
import type { AboutSectionProps } from "./AboutSectionPlaceholder";

const STAT_LABELS = ["文章", "总字数", "评论", "运行天数"] as const;

/** 展示站点持续积累的公开统计。 */
export function LiveStatsSection(_: AboutSectionProps) {
	const { data, isPending } = usePublicStats();

	if (isPending) {
		return (
			<section className={styles.section} aria-labelledby="about-stats-title">
				<AboutSectionIntro
					id="about-stats-title"
					eyebrow="Vitals / 06"
					title="这座站点仍在生长。"
				/>
				<div className={styles.statsGrid}>
					{STAT_LABELS.map((label) => (
						<div key={label} className={styles.stat}>
							<ShimmerSkeleton className={styles.statSkeletonValue} />
							<span className={styles.statLabel}>{label}</span>
						</div>
					))}
				</div>
			</section>
		);
	}

	if (!data) return null;

	const items = [
		{ label: "文章", value: data.posts_count },
		{ label: "总字数", value: data.total_words },
		{ label: "评论", value: data.comments_count },
		{ label: "运行天数", value: data.uptime_days },
	];

	return (
		<section className={styles.section} aria-labelledby="about-stats-title">
			<AboutSectionIntro
				id="about-stats-title"
				eyebrow="Vitals / 06"
				title="这座站点仍在生长。"
			/>
			<div className={styles.statsGrid}>
				{items.map((item) => (
					<div key={item.label} className={styles.stat}>
						<CountUp to={item.value} />
						<span className={styles.statLabel}>{item.label}</span>
					</div>
				))}
			</div>
		</section>
	);
}

function CountUp({ to }: { to: number }) {
	const [value, setValue] = useState(0);
	const rafRef = useRef<number | undefined>(undefined);

	useEffect(() => {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			setValue(to);
			return;
		}

		const duration = 900;
		const start = performance.now();
		const tick = (now: number) => {
			const progress = Math.min((now - start) / duration, 1);
			const eased = 1 - (1 - progress) ** 3;
			setValue(Math.round(eased * to));
			if (progress < 1) {
				rafRef.current = requestAnimationFrame(tick);
			}
		};
		rafRef.current = requestAnimationFrame(tick);
		return () => {
			if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
		};
	}, [to]);

	return <span className={styles.statValue}>{value.toLocaleString("zh-CN")}</span>;
}
