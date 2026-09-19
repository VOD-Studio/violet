import { AboutChapter } from "./AboutChapter";
import styles from "./AboutSections.module.css";
import type { AboutSectionProps } from "./types";

/** 将站点配置中的自述整理成连续叙事。 */
export function BioSection({ settings }: AboutSectionProps) {
	const bio = settings.bio.trim();
	if (!bio) return null;

	const siteName = normalizeSiteName(settings.site_name);
	const lines = bio
		.split(/\n+/)
		.map((line) => line.trim())
		.filter(Boolean);
	const detailLines = lines.filter(
		(line, index) => index > 0 || !/^(你好[，, ]*)?我是/.test(line),
	);

	return (
		<AboutChapter
			id="bio"
			title={`我和 ${siteName}`}
			intro="这不是一份履历，更像一段还在继续的自述。"
		>
			<div className={styles.bioCopy}>
				<p className={styles.bioLead}>
					我把 {siteName}
					当作一座长期维护的个人花园。文章留下正在形成的想法，代码则让这座站按我喜欢的方式运转。
				</p>
				{detailLines.map((line) => (
					<p key={line}>{line}</p>
				))}
			</div>
		</AboutChapter>
	);
}

function normalizeSiteName(value: string): string {
	const name = value.trim();
	return !name || /^(my\s+)?blog$/i.test(name) ? "Violet" : name;
}
