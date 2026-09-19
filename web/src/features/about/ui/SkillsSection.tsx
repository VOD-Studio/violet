import { Disclosure } from "@shared/ui/disclosure";

import { AboutChapter } from "./AboutChapter";
import styles from "./AboutSections.module.css";
import type { AboutSectionProps } from "./types";

/** 将技能、学习方向与兴趣组织为可展开的三组清单。 */
export function SkillsSection({ settings }: AboutSectionProps) {
	const groups = [
		{ title: "擅长", raw: settings.skills_strong },
		{ title: "在学", raw: settings.skills_learning },
		{ title: "兴趣", raw: settings.skills_interests },
	]
		.map((group) => ({
			...group,
			tags: parseTags(group.raw),
		}))
		.filter((group) => group.tags.length > 0);

	if (groups.length === 0) return null;

	return (
		<AboutChapter id="skills" title="所学与所爱" intro="点开一组，看看此刻投入时间的方向。">
			<div className={styles.skillStack}>
				{groups.map((group, index) => (
					<Disclosure
						key={group.title}
						defaultOpen={index === 0}
						summary={
							<span className={styles.skillSummaryContent}>
								<span className={styles.skillLabel}>{group.title}</span>
								<span className={styles.skillCount}>{group.tags.length} 项</span>
							</span>
						}
					>
						<div className={styles.skillTags}>
							{group.tags.map((tag) => (
								<span key={tag} className={styles.skillTag}>
									{tag}
								</span>
							))}
						</div>
					</Disclosure>
				))}
			</div>
		</AboutChapter>
	);
}

function parseTags(value: string): string[] {
	return value
		.split(/[,，、\s]+/)
		.map((tag) => tag.trim())
		.filter(Boolean);
}
