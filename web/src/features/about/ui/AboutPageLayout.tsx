import type { ReactNode } from "react";

import styles from "./AboutPage.module.css";

interface AboutPageLayoutProps {
	children: ReactNode;
	gardenSections: ReactNode;
}

/** 关于页标题与连续文章流。 */
export function AboutPageLayout({ children, gardenSections }: AboutPageLayoutProps) {
	return (
		<div className={styles.page}>
			<header id="about-top" className={styles.intro}>
				<p className={styles.eyebrow}>ABOUT</p>
				<h1 className={styles.title}>关于这座花园</h1>
				<p className={styles.subtitle}>
					“我是谁，大概只能由写下的文字和做过的东西慢慢回答。”
				</p>
			</header>

			<div className={styles.gardenSections}>{gardenSections}</div>

			<article className={styles.chapterFlow}>{children}</article>
		</div>
	);
}
