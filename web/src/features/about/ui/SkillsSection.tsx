import { DEFAULT_ABOUT_COPY } from "@features/about/model/default-copy";
import { ChevronDown } from "lucide-react";
import styles from "./AboutPage.module.css";
import { AboutSectionIntro } from "./AboutSectionIntro";
import type { AboutSectionProps } from "./AboutSectionPlaceholder";

function parseItems(raw: string, fallback: readonly string[]): string[] {
	if (!raw.trim()) return [...fallback];
	return raw
		.split(/[,，、\n]+/u)
		.map((item) => item.trim())
		.filter(Boolean);
}

/** 将技能与兴趣收进可展开的工作台索引。 */
export function SkillsSection({ settings }: AboutSectionProps) {
	const groups = [
		{
			title: "正在使用",
			items: parseItems(settings.skills_strong, DEFAULT_ABOUT_COPY.skills.strong),
		},
		{
			title: "正在学习",
			items: parseItems(settings.skills_learning, DEFAULT_ABOUT_COPY.skills.learning),
		},
		{
			title: "持续好奇",
			items: parseItems(settings.skills_interests, DEFAULT_ABOUT_COPY.skills.interests),
		},
	].filter((group) => group.items.length > 0);

	return (
		<section className={styles.section} aria-labelledby="about-skills-title">
			<AboutSectionIntro
				id="about-skills-title"
				eyebrow="Workbench / 04"
				title="我用什么，也在学什么。"
			/>
			<div className={styles.accordion}>
				{groups.map((group, index) => (
					<details key={group.title} className={styles.accordionItem} open={index === 0}>
						<summary className={styles.accordionSummary}>
							<span className={styles.accordionNumber}>
								{String(index + 1).padStart(2, "0")}
							</span>
							<span className={styles.accordionTitle}>{group.title}</span>
							<span className={styles.accordionCount}>
								{group.items.length} items
							</span>
							<ChevronDown className={styles.accordionChevron} aria-hidden="true" />
						</summary>
						<div className={styles.accordionBody}>
							<ul className={styles.skillList}>
								{group.items.map((item) => (
									<li key={item} className={styles.skillItem}>
										{item}
									</li>
								))}
							</ul>
						</div>
					</details>
				))}
			</div>
		</section>
	);
}
