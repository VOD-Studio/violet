import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";

import styles from "./AboutPage.module.css";

/** 与关于页最终结构一致的加载占位。 */
export function AboutPageSkeleton() {
	return (
		<main className={styles.page} aria-busy="true" aria-label="正在加载关于页">
			<header className={styles.intro}>
				<div>
					<ShimmerSkeleton className={styles.skeletonEyebrow} />
					<ShimmerSkeleton className={styles.skeletonTitle} />
					<ShimmerSkeleton className={styles.skeletonCopy} />
				</div>
				<ShimmerSkeleton className={styles.skeletonSignature} />
			</header>
			<div className={styles.skeletonFlow}>
				{["story", "profile", "activity"].map((section) => (
					<section key={section} className={styles.skeletonSection}>
						<ShimmerSkeleton className={styles.skeletonHeading} />
						<ShimmerSkeleton className={styles.skeletonLine} />
						<ShimmerSkeleton className={styles.skeletonLine} />
						<ShimmerSkeleton className={styles.skeletonLine} />
					</section>
				))}
			</div>
		</main>
	);
}

interface AboutPageErrorProps {
	onRetry: () => void;
	isRetrying: boolean;
}

/** 站点设置不可用时保留页面身份与可恢复操作。 */
export function AboutPageError({ onRetry, isRetrying }: AboutPageErrorProps) {
	return (
		<main className={styles.statePage}>
			<h1 className={styles.stateTitle}>关于</h1>
			<p className={styles.stateCopy}>关于页内容暂时未能载入，请稍后重试。</p>
			<button
				type="button"
				className={styles.stateAction}
				disabled={isRetrying}
				onClick={onRetry}
			>
				{isRetrying ? "正在重试" : "重新加载"}
			</button>
		</main>
	);
}
