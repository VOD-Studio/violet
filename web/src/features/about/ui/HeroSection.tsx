import { DEFAULT_ABOUT_COPY } from "@features/about/model/default-copy";
import styles from "./AboutPage.module.css";
import type { AboutSectionProps } from "./AboutSectionPlaceholder";

/** 渲染关于页的编辑式封面。 */
export function HeroSection({ settings }: AboutSectionProps) {
	const siteName = settings.site_name.trim() || DEFAULT_ABOUT_COPY.siteName;
	const tagline = settings.tagline.trim() || DEFAULT_ABOUT_COPY.tagline;

	return (
		<section className={styles.hero} aria-labelledby="about-title">
			<div className={styles.heroTopline}>
				<span className={styles.heroKicker}>About</span>
				<span className={styles.heroSite}>{siteName}</span>
			</div>
			<h1 id="about-title" className={styles.heroTitle}>
				关于
			</h1>
			<p className={styles.heroQuote}>{tagline}</p>
			<div className={styles.heroAside} aria-hidden="true">
				<span>Personal archive</span>
				<span className={styles.heroIndex}>00</span>
			</div>
		</section>
	);
}
