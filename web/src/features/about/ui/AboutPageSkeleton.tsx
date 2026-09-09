import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";
import styles from "./AboutPage.module.css";

/** 关于页数据尚未就绪时保留长卷版式的稳定占位。 */
export function AboutPageSkeleton() {
	return (
		<div className={styles.skeletonPage} aria-hidden="true">
			<div className={styles.skeletonHero}>
				<ShimmerSkeleton className={styles.skeletonKicker} />
				<ShimmerSkeleton className={styles.skeletonTitle} />
				<ShimmerSkeleton className={styles.skeletonQuote} />
			</div>
			{Array.from({ length: 3 }, (_, index) => (
				<section key={index} className={styles.skeletonSection}>
					<ShimmerSkeleton className={styles.skeletonHeading} />
					<ShimmerSkeleton className={styles.skeletonLine} />
					<ShimmerSkeleton
						className={`${styles.skeletonLine} ${styles.skeletonLineShort}`}
					/>
				</section>
			))}
		</div>
	);
}
