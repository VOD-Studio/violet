import type { ReactNode } from "react";

import styles from "./AboutPage.module.css";

interface AboutPageLayoutProps {
	hasSections: boolean;
	children: ReactNode;
}

/** 关于页标题与连续文章流。 */
export function AboutPageLayout({ hasSections, children }: AboutPageLayoutProps) {
	return (
		<main className={styles.page}>
			<header id="about-top" className={styles.intro}>
				<p className={styles.eyebrow}>ABOUT</p>
				<h1 className={styles.title}>关于</h1>
				<p className={styles.subtitle}>
					“我是谁，大概只能由写下的文字和做过的东西慢慢回答。”
				</p>
			</header>

			<article className={styles.chapterFlow}>
				{hasSections ? children : <p className={styles.empty}>更多内容正在慢慢写下。</p>}
			</article>
		</main>
	);
}
