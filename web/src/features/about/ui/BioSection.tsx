import { AboutChapter } from "./AboutChapter";
import styles from "./AboutSections.module.css";
import type { AboutSectionProps } from "./types";

/** 将站长自述排成适合连续阅读的正文。 */
export function BioSection({ settings }: AboutSectionProps) {
	const bio = settings.bio.trim();
	if (!bio) return null;

	const paragraphs = bio.split(/\n{2,}/).map((paragraph) => paragraph.trim());

	return (
		<AboutChapter id="bio" title="关于我">
			<div className={styles.bioCopy}>
				{paragraphs.map((paragraph) => (
					<p key={paragraph}>{paragraph}</p>
				))}
			</div>
		</AboutChapter>
	);
}
