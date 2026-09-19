import type { SiteSettings } from "@features/settings/model/types";
import type { ComponentType } from "react";

import { AvatarTaglineSection } from "./AvatarTaglineSection";
import { BioSection } from "./BioSection";
import { ChangelogSection } from "./ChangelogSection";
import { LiveStatsSection } from "./LiveStatsSection";
import { ProfileCardSection } from "./ProfileCardSection";
import { SkillsSection } from "./SkillsSection";
import { SocialMatrixSection } from "./SocialMatrixSection";
import type { AboutSectionProps } from "./types";

export const ABOUT_SECTION_IDS = [
	"avatar_tagline",
	"bio",
	"profile_card",
	"skills",
	"social_matrix",
	"live_stats",
	"changelog",
] as const;

export type AboutSectionId = (typeof ABOUT_SECTION_IDS)[number];

export const ABOUT_SECTION_LABELS: Record<string, string> = {
	avatar_tagline: "开场头像与标语",
	bio: "个人简介",
	profile_card: "当前资料",
	skills: "技能与兴趣",
	social_matrix: "公开联系方式",
	live_stats: "站点近况",
	changelog: "最近更新",
};

interface AboutSectionDefinition {
	navigationLabel: string;
	Component: ComponentType<AboutSectionProps>;
	isVisible: (settings: SiteSettings) => boolean;
}

export interface ResolvedAboutSection {
	id: AboutSectionId;
	label: string;
	Component: ComponentType<AboutSectionProps>;
}

const registry: Record<AboutSectionId, AboutSectionDefinition> = {
	avatar_tagline: {
		navigationLabel: "打招呼",
		Component: AvatarTaglineSection,
		isVisible: (settings) => hasText(settings.avatar_url, settings.tagline),
	},
	bio: {
		navigationLabel: "关于我",
		Component: BioSection,
		isVisible: (settings) => hasText(settings.bio),
	},
	profile_card: {
		navigationLabel: "现在",
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
		navigationLabel: "所学与所爱",
		Component: SkillsSection,
		isVisible: (settings) =>
			hasText(settings.skills_strong, settings.skills_learning, settings.skills_interests),
	},
	social_matrix: {
		navigationLabel: "保持联系",
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
		navigationLabel: "站点近况",
		Component: LiveStatsSection,
		isVisible: () => true,
	},
	changelog: {
		navigationLabel: "最近更新",
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
		label: definition.navigationLabel,
		Component: definition.Component,
	};
}

function isAboutSectionId(id: string): id is AboutSectionId {
	return ABOUT_SECTION_IDS.includes(id as AboutSectionId);
}

function hasText(...values: string[]): boolean {
	return values.some((value) => value.trim().length > 0);
}
