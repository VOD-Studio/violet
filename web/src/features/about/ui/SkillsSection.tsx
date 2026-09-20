import { Disclosure } from "@shared/ui/disclosure";
import {
	Atom,
	BookOpen,
	Braces,
	Code2,
	Database,
	FileCode2,
	type LucideIcon,
	Palette,
	Sparkles,
	Waves,
} from "lucide-react";
import type { CSSProperties } from "react";

import { AboutChapter } from "./AboutChapter";
import styles from "./AboutSections.module.css";
import type { AboutSectionProps } from "./types";

interface SkillGroup {
	title: string;
	Icon: LucideIcon;
	fallbackDescription: string;
	tags: string[];
}

interface TechnologyDetails {
	Icon: LucideIcon;
	description: string;
	color: string;
}

type TechnologyStyle = CSSProperties & {
	"--technology-color": string;
};

const technologyDetails: Record<string, TechnologyDetails> = {
	go: {
		Icon: Braces,
		description: "服务端用例与领域逻辑",
		color: "#00add8",
	},
	react: {
		Icon: Atom,
		description: "页面、状态与交互组件",
		color: "#087ea4",
	},
	postgresql: {
		Icon: Database,
		description: "关系数据与查询边界",
		color: "#336791",
	},
	typescript: {
		Icon: FileCode2,
		description: "前端类型与数据契约",
		color: "#3178c6",
	},
	tailwind: {
		Icon: Waves,
		description: "受约束的界面样式系统",
		color: "#0ea5e9",
	},
	"tailwind css": {
		Icon: Waves,
		description: "受约束的界面样式系统",
		color: "#0ea5e9",
	},
	css: {
		Icon: Palette,
		description: "排版、布局与微交互",
		color: "#663399",
	},
};

/** 将技术、学习方向与兴趣组织为文章内的可展开清单。 */
export function SkillsSection({ settings }: AboutSectionProps) {
	const groups: SkillGroup[] = [
		{
			title: "核心工具",
			raw: settings.skills_strong,
			Icon: Code2,
			fallbackDescription: "当前项目中的常用工具",
		},
		{
			title: "正在学习",
			raw: settings.skills_learning,
			Icon: BookOpen,
			fallbackDescription: "正在补齐理解与实践",
		},
		{
			title: "保持好奇",
			raw: settings.skills_interests,
			Icon: Sparkles,
			fallbackDescription: "因为好奇而持续关注",
		},
	]
		.map(({ raw, ...group }) => ({ ...group, tags: parseTags(raw) }))
		.filter((group) => group.tags.length > 0);

	if (groups.length === 0) return null;

	return (
		<AboutChapter id="skills" title="Q1：这个站点用到了哪些技术？">
			<div className={styles.prose}>
				<p>
					{normalizeSiteName(settings.site_name)}{" "}
					不是一次写完的成品。后端从业务边界开始整理，前端则一边调整排版，一边把真实交互磨顺；技术选择也跟着遇到的问题持续变化。
				</p>
				<p>
					这里没有为了显得复杂而堆满一屏名词。具体在用什么、各自负责什么，都放在下面了。
				</p>
			</div>

			<div className={styles.skillStack}>
				{groups.map((group, index) => (
					<Disclosure
						key={group.title}
						variant="panel"
						defaultOpen={index === 0}
						className={styles.skillDisclosure}
						summaryClassName={styles.skillDisclosureSummary}
						contentClassName={styles.skillDisclosureContent}
						summary={
							<span className={styles.skillSummaryContent}>
								<span className={styles.skillGroupIcon}>
									<group.Icon aria-hidden />
								</span>
								<span className={styles.skillLabel}>{group.title}</span>
								<span className={styles.skillCount}>{group.tags.length} 项</span>
							</span>
						}
					>
						<div className={styles.skillGrid}>
							{group.tags.map((technology) => {
								const details = resolveTechnology(
									technology,
									group.fallbackDescription,
								);
								const TechnologyIcon = details.Icon;
								return (
									<div
										key={technology}
										className={styles.skillCard}
										style={
											{
												"--technology-color": details.color,
											} as TechnologyStyle
										}
									>
										<TechnologyIcon
											className={styles.technologyIcon}
											aria-hidden
										/>
										<strong className={styles.technologyName}>
											{technology}
										</strong>
										<span className={styles.technologyDescription}>
											{details.description}
										</span>
									</div>
								);
							})}
						</div>
					</Disclosure>
				))}
			</div>
		</AboutChapter>
	);
}

function resolveTechnology(technology: string, fallbackDescription: string): TechnologyDetails {
	return (
		technologyDetails[technology.toLowerCase()] ?? {
			Icon: Code2,
			description: fallbackDescription,
			color: "var(--primary)",
		}
	);
}

function parseTags(value: string): string[] {
	const separated = value
		.split(/[,，、;\n]+/)
		.map((tag) => tag.trim())
		.filter(Boolean);
	if (separated.length > 1) return separated;
	return value
		.split(/\s+/)
		.map((tag) => tag.trim())
		.filter(Boolean);
}

function normalizeSiteName(value: string): string {
	const name = value.trim();
	return !name || /^(my\s+)?blog$/i.test(name) ? "Violet" : name;
}
