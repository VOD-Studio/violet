import type { ReactNode } from "react";
import { growthNumber } from "../model/growth";

import styles from "./AboutPage.module.css";

/** 生长图与保留的站点区块使用独立插槽。 */
export interface AboutPageLayoutProps {
	children: ReactNode;
	gardenSections: ReactNode;
	growthSection: ReactNode;
	/** 未确认首次提交时不显示运行天数。 */
	elapsedDays: number | null;
}

/** 关于页标题、生长图和下方区块的版式。 */
export function AboutPageLayout({
	children,
	gardenSections,
	growthSection,
	elapsedDays,
}: AboutPageLayoutProps) {
	return (
		<div className={styles.page}>
			<header id="about-top" className={styles.hero}>
				<h1 className={styles.title}>
					这座花园
					{elapsedDays !== null && (
						<>
							，<br />
							种下{" "}
							<span className={styles.dayCount}>{growthNumber(elapsedDays)}</span>{" "}
							天了。
						</>
					)}
				</h1>
				<p className={styles.subtitle}>
					它从一次提交长起。茎记下经过的时间，叶片是一周的提交，花苞是公开发布的版本。
				</p>
			</header>

			{growthSection}

			<div className={styles.gardenSections}>{gardenSections}</div>

			<article className={styles.chapterFlow}>{children}</article>
		</div>
	);
}
