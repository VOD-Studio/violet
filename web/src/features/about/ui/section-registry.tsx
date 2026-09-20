import type { SiteSettings } from "@features/settings/model/types";
import type { ComponentType } from "react";

import { BioSection } from "./BioSection";
import { ChangelogSection } from "./ChangelogSection";
import { LiveStatsSection } from "./LiveStatsSection";
import { ProfileCardSection } from "./ProfileCardSection";
import { SkillsSection } from "./SkillsSection";
import { SocialMatrixSection } from "./SocialMatrixSection";
import type { AboutSectionProps } from "./types";

export const ABOUT_SECTION_IDS = [
	"bio",
	"profile_card",
	"skills",
	"social_matrix",
	"live_stats",
	"changelog",
] as const;

export type AboutSectionId = (typeof ABOUT_SECTION_IDS)[number];

export const ABOUT_SECTION_LABELS: Record<string, string> = {
	bio: "个人自述",
	profile_card: "当前状态",
	skills: "技能与兴趣",
	social_matrix: "公开联系方式",
	live_stats: "站点数字",
	changelog: "最近更新",
};

interface AboutSectionDefinition {
	Component: ComponentType<AboutSectionProps>;
	isVisible: (settings: SiteSettings) => boolean;
}

export interface ResolvedAboutSection {
	id: AboutSectionId;
	Component: ComponentType<AboutSectionProps>;
}

const registry: Record<AboutSectionId, AboutSectionDefinition> = {
	bio: {
		Component: BioSection,
		isVisible: () => true,
	},
	profile_card: {
		Component: ProfileCardSection,
		isVisible: (settings) =>
			hasText(
				settings.profile_role,
				settings.profile_location,
				settings.available_for,
				settings.social_email,
			),
	},
	skills: {
		Component: SkillsSection,
		isVisible: (settings) =>
			hasText(settings.skills_strong, settings.skills_learning, settings.skills_interests),
	},
	social_matrix: {
		Component: SocialMatrixSection,
		isVisible: (settings) =>
			hasText(
				settings.github_username,
				settings.social_twitter,
				settings.social_mastodon,
				settings.social_email,
				settings.social_rss,
				settings.social_bilibili,
			),
	},
	live_stats: {
		Component: LiveStatsSection,
		isVisible: () => true,
	},
	changelog: {
		Component: ChangelogSection,
		isVisible: () => true,
	},
};

/** 解析已注册且具备可展示内容的关于页区块。 */
export function resolveAboutSection(
	id: string,
	settings: SiteSettings,
): ResolvedAboutSection | null {
	if (!isAboutSectionId(id)) return null;
	const definition = registry[id];
	if (!definition.isVisible(settings)) return null;
	return {
		id,
		Component: definition.Component,
	};
}

function isAboutSectionId(id: string): id is AboutSectionId {
	return ABOUT_SECTION_IDS.includes(id as AboutSectionId);
}

function hasText(...values: string[]): boolean {
	return values.some((value) => value.trim().length > 0);
}
