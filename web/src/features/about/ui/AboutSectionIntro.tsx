import styles from "./AboutPage.module.css";

interface AboutSectionIntroProps {
	id: string;
	eyebrow: string;
	title: string;
}

/** 统一关于页长卷章节的索引与标题排版。 */
export function AboutSectionIntro({ id, eyebrow, title }: AboutSectionIntroProps) {
	return (
		<header className={styles.sectionIntro}>
			<span className={styles.eyebrow}>{eyebrow}</span>
			<h2 id={id} className={styles.sectionTitle}>
				{title}
			</h2>
		</header>
	);
}
