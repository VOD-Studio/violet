import { DEFAULT_ABOUT_COPY } from "@features/about/model/default-copy";
import styles from "./AboutPage.module.css";
import { AboutSectionIntro } from "./AboutSectionIntro";
import type { AboutSectionProps } from "./AboutSectionPlaceholder";

/** 把后台简介排成可连续阅读的作者自述。 */
export function BioSection({ settings }: AboutSectionProps) {
	const paragraphs = settings.bio.trim()
		? settings.bio
				.split(/\n+/u)
				.map((line) => line.trim())
				.filter(Boolean)
		: [...DEFAULT_ABOUT_COPY.bio];

	return (
		<section className={styles.section} aria-labelledby="about-bio-title">
			<AboutSectionIntro
				id="about-bio-title"
				eyebrow="Letter / 02"
				title="关于我，也关于这里。"
			/>
			<div className={styles.bioCopy}>
				{paragraphs.map((paragraph) => (
					<p key={paragraph} className={styles.bioParagraph}>
						{paragraph}
					</p>
				))}
			</div>
		</section>
	);
}
