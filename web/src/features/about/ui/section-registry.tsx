import type { ComponentType } from "react";
import type { AboutSectionProps } from "./AboutSectionPlaceholder";
import { AvatarTaglineSection } from "./AvatarTaglineSection";
import { BioSection } from "./BioSection";
import { ChangelogSection } from "./ChangelogSection";
import { HeroSection } from "./HeroSection";
import { LiveStatsSection } from "./LiveStatsSection";
import { ProfileCardSection } from "./ProfileCardSection";
import { SkillsSection } from "./SkillsSection";
import { SocialMatrixSection } from "./SocialMatrixSection";

/** 关于页后台排序与前台注册表共用的稳定区块标识。 */
export const ABOUT_SECTION_IDS = [
	"hero",
	"avatar_tagline",
	"bio",
	"profile_card",
	"skills",
	"social_matrix",
	"live_stats",
	"changelog",
] as const;

export type AboutSectionId = (typeof ABOUT_SECTION_IDS)[number];

/** 区块 id 对应的后台显示名。 */
export const ABOUT_SECTION_LABELS: Record<string, string> = {
	hero: "编辑式封面",
	avatar_tagline: "作者头像与标语",
	bio: "作者自述",
	profile_card: "身份索引",
	skills: "技能与兴趣折叠册",
	social_matrix: "站外链接",
	live_stats: "站点统计",
	changelog: "最近更新",
};

/**
 * 区块注册表 - section id → 渲染组件
 *
 * 所有保留区块均有真实组件，无占位。未知 id（历史配置残留）返回 null 不渲染，
 * 避免「开了区块却显示虚线占位框」的问题。
 */
const registry: Record<string, ComponentType<AboutSectionProps>> = {
	hero: HeroSection,
	avatar_tagline: AvatarTaglineSection,
	bio: BioSection,
	profile_card: ProfileCardSection,
	skills: SkillsSection,
	social_matrix: SocialMatrixSection,
	live_stats: LiveStatsSection,
	changelog: ChangelogSection,
};

/** 取某区块的渲染组件；未注册的 id 返回 null（不渲染占位） */
export function resolveSectionComponent(id: string): ComponentType<AboutSectionProps> | null {
	return registry[id] ?? null;
}
